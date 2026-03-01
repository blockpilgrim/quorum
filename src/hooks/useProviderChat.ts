/**
 * Custom hook wrapping `useChat` for a single provider column.
 *
 * Responsibilities:
 * - Configures `useChat` to hit the proxy endpoint with provider/model/apiKey
 * - Syncs messages to Dexie on send (user messages) and on completion (assistant messages)
 * - Seeds `useChat` with messages from Dexie when the active conversation changes
 * - Exposes streaming status and error state for the UI
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import { addMessage, getMessagesByThread } from '@/lib/db'
import { getSettings } from '@/lib/db/settings'
import type { Provider, TokenCount } from '@/lib/db/types'
import { useAppStore } from '@/lib/store'

interface UseProviderChatOptions {
  /** Which AI provider this chat instance is for. */
  provider: Provider
  /** The active conversation ID (null = no conversation). */
  conversationId: number | null
  /** The model ID to use (e.g., 'claude-sonnet-4-20250514'). */
  model: string
}

/** Options for cross-feed metadata when sending a message. */
export interface SendOptions {
  isCrossFeed?: boolean
  crossFeedRound?: number
}

interface UseProviderChatReturn {
  /** Current messages from `useChat` (includes streaming partials). */
  messages: UIMessage[]
  /** Chat status: 'ready' | 'submitted' | 'streaming' | 'error'. */
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  /** Error from the last request, if any. */
  error: Error | undefined
  /** Send a user message. Returns false if the message cannot be sent. */
  send: (text: string, options?: SendOptions) => Promise<boolean>
  /** Stop the current stream. */
  stop: () => void
  /** Clear the error and reset status to ready. */
  clearError: () => void
  /** Whether the provider is actively streaming or waiting for a response. */
  isLoading: boolean
  /** Set of UIMessage IDs that are cross-feed messages. */
  crossFeedIds: Set<string>
  /** Map of UIMessage IDs to token counts (for assistant messages). */
  tokenCountMap: Map<string, TokenCount>
}

/**
 * Extract the text content from a UIMessage's parts array.
 * UIMessage uses a parts-based structure; we need to extract text parts.
 */
export function getMessageText(message: UIMessage): string {
  if (!message.parts) return ''
  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    )
    .map((part) => part.text)
    .join('')
}

/**
 * Convert Dexie messages to the UIMessage format expected by useChat.
 * Also returns a set of IDs for cross-feed messages and a map of token counts.
 */
function toUIMessages(
  dbMessages: Array<{
    id?: number
    role: 'user' | 'assistant'
    content: string
    isCrossFeed?: boolean
    tokenCount?: TokenCount | null
  }>,
): {
  uiMessages: UIMessage[]
  crossFeedIds: Set<string>
  tokenCountMap: Map<string, TokenCount>
} {
  const crossFeedIds = new Set<string>()
  const tokenCountMap = new Map<string, TokenCount>()
  const uiMessages = dbMessages.map((msg) => {
    const id = String(msg.id ?? Math.random())
    if (msg.isCrossFeed) {
      crossFeedIds.add(id)
    }
    if (msg.tokenCount) {
      tokenCountMap.set(id, msg.tokenCount)
    }
    return {
      id,
      role: msg.role,
      parts: [{ type: 'text' as const, text: msg.content }],
    }
  })
  return { uiMessages, crossFeedIds, tokenCountMap }
}

export function useProviderChat({
  provider,
  conversationId,
  model,
}: UseProviderChatOptions): UseProviderChatReturn {
  // Track the conversation ID that messages are currently seeded for,
  // so we only re-seed when it actually changes.
  const seededConversationRef = useRef<number | null>(null)

  // Set of UIMessage IDs that are cross-feed messages, for visual styling.
  const [crossFeedIds, setCrossFeedIds] = useState<Set<string>>(new Set())

  // Map of UIMessage IDs to token counts (populated from Dexie and onFinish).
  const [tokenCountMap, setTokenCountMap] = useState<Map<string, TokenCount>>(
    new Map(),
  )

  // Track whether we are currently persisting to avoid double-saves.
  const persistingRef = useRef(false)

  // Track cross-feed metadata for the current request so onFinish can use it.
  const pendingCrossFeedRef = useRef<SendOptions>({})

  // Use refs for values needed in the transport's prepareSendMessagesRequest
  // callback to avoid recreating the transport on every render.
  const providerRef = useRef(provider)
  providerRef.current = provider
  const modelRef = useRef(model)
  modelRef.current = model

  // Create a stable transport instance that uses refs for dynamic values.
  // The transport is configured once and reads current provider/model/apiKey
  // at request time via the prepareSendMessagesRequest callback.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest: async ({ messages: chatMessages }) => {
          const settings = await getSettings()
          const apiKey = settings.apiKeys[providerRef.current]

          if (!apiKey) {
            throw new Error(
              `No API key configured for ${providerRef.current}. Please add your key in settings.`,
            )
          }

          // Convert UIMessages to the simple {role, content} format the proxy expects
          const simpleMessages = chatMessages.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: getMessageText(msg),
          }))

          return {
            body: {
              provider: providerRef.current,
              model: modelRef.current,
              messages: simpleMessages,
              apiKey,
            },
          }
        },
      }),
    [], // Intentionally stable -- uses refs for dynamic values
  )

  const {
    messages,
    setMessages,
    sendMessage,
    stop,
    status,
    error,
    clearError,
  } = useChat({
    id: `${provider}-${conversationId ?? 'none'}`,
    transport,
    onFinish: useCallback(
      async ({ message }: { message: UIMessage }) => {
        // Persist the completed assistant message to Dexie
        if (conversationId === null || persistingRef.current) return
        persistingRef.current = true
        try {
          const content = getMessageText(message)
          if (content) {
            const crossFeedOpts = pendingCrossFeedRef.current

            // Extract token usage from message metadata (sent by the proxy)
            const metadata = message.metadata as
              | {
                  usage?: {
                    inputTokens?: number
                    outputTokens?: number
                  }
                }
              | undefined
            const usage = metadata?.usage
            const tokenCount =
              usage &&
              (usage.inputTokens !== undefined ||
                usage.outputTokens !== undefined)
                ? {
                    input: usage.inputTokens ?? 0,
                    output: usage.outputTokens ?? 0,
                  }
                : null

            await addMessage({
              conversationId,
              provider,
              role: 'assistant',
              content,
              tokenCount,
              isCrossFeed: crossFeedOpts.isCrossFeed,
              crossFeedRound: crossFeedOpts.crossFeedRound,
            })

            // Update the token count map for the UI
            if (tokenCount) {
              setTokenCountMap((prev) => {
                const next = new Map(prev)
                next.set(message.id, tokenCount)
                return next
              })
            }
          }
        } finally {
          persistingRef.current = false
          pendingCrossFeedRef.current = {}
        }
      },
      [conversationId, provider],
    ),
    onError: useCallback(
      (err: Error) => {
        console.error(`[${provider}] Chat error:`, err.message)
      },
      [provider],
    ),
  })

  // Track cross-feed IDs for messages created during the current session.
  // When a cross-feed send is in progress, new messages that appear in the
  // useChat messages array are added to the crossFeedIds set.
  const prevMessageIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const currentIds = new Set(messages.map((m) => m.id))
    if (pendingCrossFeedRef.current.isCrossFeed) {
      const newIds: string[] = []
      for (const id of currentIds) {
        if (!prevMessageIdsRef.current.has(id)) {
          newIds.push(id)
        }
      }
      if (newIds.length > 0) {
        setCrossFeedIds((prev) => {
          const next = new Set(prev)
          for (const id of newIds) {
            next.add(id)
          }
          return next
        })
      }
    }
    prevMessageIdsRef.current = currentIds
  }, [messages])

  // Sync streaming status to Zustand store so other components
  // (like InputBar) can react without reading refs during render.
  const setStreamingStatus = useAppStore((s) => s.setStreamingStatus)
  useEffect(() => {
    const isActive = status === 'submitted' || status === 'streaming'
    setStreamingStatus(provider, isActive)
  }, [status, provider, setStreamingStatus])

  // Seed messages from Dexie when the conversation changes
  useEffect(() => {
    if (conversationId === null) {
      // No active conversation: clear messages
      setMessages([])
      setCrossFeedIds(new Set())
      setTokenCountMap(new Map())
      seededConversationRef.current = null
      return
    }

    if (seededConversationRef.current === conversationId) {
      // Already seeded for this conversation
      return
    }

    let cancelled = false

    async function seedMessages() {
      if (conversationId === null) return
      try {
        const dbMessages = await getMessagesByThread(conversationId, provider)
        if (cancelled) return
        const {
          uiMessages,
          crossFeedIds: cfIds,
          tokenCountMap: tcMap,
        } = toUIMessages(dbMessages)
        setMessages(uiMessages)
        setCrossFeedIds(cfIds)
        setTokenCountMap(tcMap)
        seededConversationRef.current = conversationId
      } catch (err) {
        console.error(`[${provider}] Failed to seed messages:`, err)
      }
    }

    seedMessages()

    return () => {
      cancelled = true
    }
  }, [conversationId, provider, setMessages])

  // Send function that also persists the user message to Dexie
  const send = useCallback(
    async (text: string, options?: SendOptions): Promise<boolean> => {
      if (conversationId === null) return false

      const trimmed = text.trim()
      if (!trimmed) return false

      if (status !== 'ready') return false

      try {
        // Store cross-feed metadata so onFinish can use it for the assistant message
        pendingCrossFeedRef.current = options ?? {}

        // Persist user message to Dexie first
        await addMessage({
          conversationId,
          provider,
          role: 'user',
          content: trimmed,
          isCrossFeed: options?.isCrossFeed,
          crossFeedRound: options?.crossFeedRound,
        })

        // Then send via useChat (which triggers the streaming request)
        await sendMessage({ text: trimmed })
        return true
      } catch (err) {
        console.error(`[${provider}] Failed to send message:`, err)
        pendingCrossFeedRef.current = {}
        return false
      }
    },
    [conversationId, provider, status, sendMessage],
  )

  const isLoading = status === 'submitted' || status === 'streaming'

  return {
    messages,
    status,
    error,
    send,
    stop,
    clearError,
    isLoading,
    crossFeedIds,
    tokenCountMap,
  }
}
