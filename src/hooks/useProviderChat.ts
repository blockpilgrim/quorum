/**
 * Custom hook wrapping `useChat` for a single provider column.
 *
 * Responsibilities:
 * - Configures `useChat` to hit the proxy endpoint with provider/model/apiKey
 * - Syncs messages to Dexie on send (user messages) and on completion (assistant messages)
 * - Seeds `useChat` with messages from Dexie when the active conversation changes
 * - Exposes streaming status and error state for the UI
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import { addMessage, getMessagesByThread } from '@/lib/db'
import { getSettings } from '@/lib/db/settings'
import type { Provider } from '@/lib/db/types'
import { useAppStore } from '@/lib/store'

interface UseProviderChatOptions {
  /** Which AI provider this chat instance is for. */
  provider: Provider
  /** The active conversation ID (null = no conversation). */
  conversationId: number | null
  /** The model ID to use (e.g., 'claude-sonnet-4-20250514'). */
  model: string
}

interface UseProviderChatReturn {
  /** Current messages from `useChat` (includes streaming partials). */
  messages: UIMessage[]
  /** Chat status: 'ready' | 'submitted' | 'streaming' | 'error'. */
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  /** Error from the last request, if any. */
  error: Error | undefined
  /** Send a user message. Returns false if the message cannot be sent. */
  send: (text: string) => Promise<boolean>
  /** Stop the current stream. */
  stop: () => void
  /** Clear the error and reset status to ready. */
  clearError: () => void
  /** Whether the provider is actively streaming or waiting for a response. */
  isLoading: boolean
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
 */
function toUIMessages(
  dbMessages: Array<{
    id?: number
    role: 'user' | 'assistant'
    content: string
  }>,
): UIMessage[] {
  return dbMessages.map((msg) => ({
    id: String(msg.id ?? Math.random()),
    role: msg.role,
    parts: [{ type: 'text' as const, text: msg.content }],
  }))
}

export function useProviderChat({
  provider,
  conversationId,
  model,
}: UseProviderChatOptions): UseProviderChatReturn {
  // Track the conversation ID that messages are currently seeded for,
  // so we only re-seed when it actually changes.
  const seededConversationRef = useRef<number | null>(null)

  // Track whether we are currently persisting to avoid double-saves.
  const persistingRef = useRef(false)

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
            await addMessage({
              conversationId,
              provider,
              role: 'assistant',
              content,
            })
          }
        } finally {
          persistingRef.current = false
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
        setMessages(toUIMessages(dbMessages))
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
    async (text: string): Promise<boolean> => {
      if (conversationId === null) return false

      const trimmed = text.trim()
      if (!trimmed) return false

      if (status !== 'ready') return false

      try {
        // Persist user message to Dexie first
        await addMessage({
          conversationId,
          provider,
          role: 'user',
          content: trimmed,
        })

        // Then send via useChat (which triggers the streaming request)
        await sendMessage({ text: trimmed })
        return true
      } catch (err) {
        console.error(`[${provider}] Failed to send message:`, err)
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
  }
}
