/**
 * App shell -- the root layout component for Cortex.
 *
 * Layout structure:
 * - TopBar (fixed height)
 * - Content area (fills remaining height):
 *   - ConversationSidebar (desktop: inline, mobile: Sheet overlay)
 *   - Main area:
 *     - Three model columns (flex-row on desktop, flex-col stacked on mobile)
 *     - InputBar pinned to bottom
 *
 * Orchestrates sending messages to all providers concurrently.
 * On first message, auto-creates a conversation in Dexie.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { TopBar } from '@/components/TopBar'
import { ConversationSidebar } from '@/components/ConversationSidebar'
import { ConversationSearch } from '@/components/ConversationSearch'
import { ModelColumn } from '@/components/ModelColumn'
import type { ModelColumnHandle } from '@/components/ModelColumn'
import { InputBar } from '@/components/InputBar'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAppStore } from '@/lib/store'
import {
  createConversation,
  getConversation,
  getSettings,
  getMessagesByThread,
  updateConversation,
} from '@/lib/db'
import {
  buildCrossFeedMessages,
  findLastAssistant,
  getNextCrossFeedRound,
} from '@/lib/crossfeed'
import { db } from '@/lib/db'
import { generateTitle } from '@/lib/utils'

function App() {
  const activeConversationId = useAppStore((s) => s.activeConversationId)
  const setActiveConversationId = useAppStore((s) => s.setActiveConversationId)
  const selectedModels = useAppStore((s) => s.selectedModels)
  const streamingStatus = useAppStore((s) => s.streamingStatus)

  const setSelectedModels = useAppStore((s) => s.setSelectedModels)

  // Conversation search dialog state (Cmd/Ctrl+K)
  const [searchOpen, setSearchOpen] = useState(false)

  // On mount, load persisted settings from Dexie and sync to Zustand.
  // This ensures the store starts with persisted model selections, not just defaults.
  useEffect(() => {
    async function syncSettings() {
      try {
        const settings = await getSettings()
        setSelectedModels(settings.selectedModels)
      } catch (err) {
        console.error('[App] Failed to sync settings from Dexie:', err)
      }
    }
    syncSettings()
  }, [setSelectedModels])

  // Restore model config from the conversation record when switching conversations.
  // Each conversation stores the model selections that were active when it was created.
  useEffect(() => {
    if (activeConversationId === null) return

    async function restoreModelConfig() {
      try {
        const conversation = await getConversation(activeConversationId!)
        if (conversation?.modelConfig) {
          setSelectedModels(conversation.modelConfig)
        }
      } catch (err) {
        console.error('[App] Failed to restore model config:', err)
      }
    }
    restoreModelConfig()
  }, [activeConversationId, setSelectedModels])

  // Derived streaming state from the Zustand store (safe to read during render)
  const isAnyStreaming =
    streamingStatus.claude || streamingStatus.chatgpt || streamingStatus.gemini

  // Refs to each model column's imperative handle (only accessed in callbacks)
  const claudeRef = useRef<ModelColumnHandle>(null)
  const chatgptRef = useRef<ModelColumnHandle>(null)
  const geminiRef = useRef<ModelColumnHandle>(null)

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null)
  }, [setActiveConversationId])

  const handleSearchOpen = useCallback(() => {
    setSearchOpen(true)
  }, [])

  // Register global keyboard shortcuts
  useKeyboardShortcuts({
    onNewConversation: handleNewConversation,
    onSearchOpen: handleSearchOpen,
  })

  // Track whether cross-feed is available: all three providers must have
  // at least one assistant message in the active conversation.
  // useLiveQuery reactively updates when messages change in Dexie.
  const hasCrossFeedContent = useLiveQuery(
    async () => {
      if (activeConversationId === null) return false

      // Check each provider for at least one assistant message.
      // Use count queries for efficiency (no need to load full messages).
      const providers = ['claude', 'chatgpt', 'gemini'] as const
      const counts = await Promise.all(
        providers.map((p) =>
          db.messages
            .where('[conversationId+provider+timestamp]')
            .between(
              [activeConversationId, p, ''],
              [activeConversationId, p, '\uffff'],
            )
            .filter((msg) => msg.role === 'assistant')
            .count(),
        ),
      )
      return counts.every((c) => c > 0)
    },
    [activeConversationId],
    false, // default value while loading
  )

  const handleCrossFeed = useCallback(async () => {
    if (!activeConversationId) return

    try {
      // Get latest messages from each provider
      const [claudeMsgs, chatgptMsgs, geminiMsgs] = await Promise.all([
        getMessagesByThread(activeConversationId, 'claude'),
        getMessagesByThread(activeConversationId, 'chatgpt'),
        getMessagesByThread(activeConversationId, 'gemini'),
      ])

      // Find the last assistant message for each
      const lastClaude = findLastAssistant(claudeMsgs)
      const lastChatgpt = findLastAssistant(chatgptMsgs)
      const lastGemini = findLastAssistant(geminiMsgs)

      // All three must have at least one assistant response
      if (!lastClaude || !lastChatgpt || !lastGemini) return

      // Determine cross-feed round number
      const round = getNextCrossFeedRound(claudeMsgs, chatgptMsgs, geminiMsgs)

      // Build cross-feed messages
      const crossFeedMessages = buildCrossFeedMessages({
        claude: lastClaude.content,
        chatgpt: lastChatgpt.content,
        gemini: lastGemini.content,
      })

      const sendOptions = { isCrossFeed: true, crossFeedRound: round }

      // Send to all three concurrently with cross-feed metadata
      const sendPromises: Promise<boolean>[] = []
      if (claudeRef.current) {
        sendPromises.push(
          claudeRef.current.send(crossFeedMessages.claude, sendOptions),
        )
      }
      if (chatgptRef.current) {
        sendPromises.push(
          chatgptRef.current.send(crossFeedMessages.chatgpt, sendOptions),
        )
      }
      if (geminiRef.current) {
        sendPromises.push(
          geminiRef.current.send(crossFeedMessages.gemini, sendOptions),
        )
      }

      await Promise.allSettled(sendPromises)
    } catch (err) {
      console.error('[App] handleCrossFeed failed:', err)
    }
  }, [activeConversationId])

  const handleSend = useCallback(
    async (text: string) => {
      try {
        let conversationId = activeConversationId

        // Auto-create a conversation if none is active
        if (conversationId === null) {
          conversationId = await createConversation({
            title: generateTitle(text),
            modelConfig: { ...selectedModels },
          })
          setActiveConversationId(conversationId)

          // Allow the state update and useProviderChat seeding effect to settle.
          // The seeding effect runs on conversationId change; without this delay,
          // send() fires before the hook sees the new ID. This is a known
          // timing-based workaround — may be replaced with a ref-based queue or
          // callback pattern if it proves flaky on slower devices.
          await new Promise((resolve) => setTimeout(resolve, 50))
        } else {
          // Update the conversation's updatedAt timestamp
          await updateConversation(conversationId, {})
        }

        // Send to all three providers concurrently via imperative handles.
        // Each send() is independent -- Promise.allSettled ensures one provider
        // failing does not block or affect the others.
        const sendPromises: Promise<boolean>[] = []
        if (claudeRef.current) {
          sendPromises.push(claudeRef.current.send(text))
        }
        if (chatgptRef.current) {
          sendPromises.push(chatgptRef.current.send(text))
        }
        if (geminiRef.current) {
          sendPromises.push(geminiRef.current.send(text))
        }

        await Promise.allSettled(sendPromises)
      } catch (err) {
        console.error('[App] handleSend failed:', err)
      }
    },
    [activeConversationId, setActiveConversationId, selectedModels],
  )

  return (
    <div className="bg-background flex h-dvh flex-col">
      <TopBar onNewConversation={handleNewConversation} />

      <div className="flex min-h-0 flex-1">
        <ConversationSidebar onNewConversation={handleNewConversation} />

        {/* Main content area */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Model columns: 3-column grid on desktop, stacked on mobile */}
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <ModelColumn ref={claudeRef} provider="claude" label="Claude" />
            <ModelColumn
              ref={chatgptRef}
              provider="chatgpt"
              label="ChatGPT"
            />
            <ModelColumn ref={geminiRef} provider="gemini" label="Gemini" />
          </div>

          <InputBar
            onSend={handleSend}
            onCrossFeed={handleCrossFeed}
            isStreaming={isAnyStreaming}
            hasCrossFeedContent={hasCrossFeedContent}
          />
        </main>
      </div>

      {/* Conversation search dialog (Cmd/Ctrl+K) */}
      <ConversationSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}

export default App
