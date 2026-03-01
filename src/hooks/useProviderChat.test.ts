/**
 * Tests for useProviderChat hook.
 *
 * Since useProviderChat wraps the AI SDK's useChat (which is complex to fully
 * mock in a hook test), we test:
 * 1. The exported `getMessageText` utility function (pure logic)
 * 2. The persistence and seeding behavior via integration with Dexie
 * 3. The streaming status sync to Zustand
 *
 * The useChat hook is mocked to avoid AI SDK transport/network dependencies.
 */

import 'fake-indexeddb/auto'

import { renderHook, act, waitFor } from '@testing-library/react'
import type { UIMessage } from 'ai'
import { getMessageText, useProviderChat } from '@/hooks/useProviderChat'
import { useAppStore } from '@/lib/store'
import { db, addMessage } from '@/lib/db'

// Track mock state that the mock useChat will use
let mockMessages: UIMessage[] = []
let mockStatus: 'ready' | 'submitted' | 'streaming' | 'error' = 'ready'
let mockError: Error | undefined = undefined
let capturedOnFinish: ((opts: { message: UIMessage }) => void) | undefined
const mockSetMessages = vi.fn((msgs: UIMessage[]) => {
  mockMessages =
    typeof msgs === 'function'
      ? (msgs as (prev: UIMessage[]) => UIMessage[])(mockMessages)
      : msgs
})
const mockSendMessage = vi.fn()
const mockStop = vi.fn()
const mockClearError = vi.fn()

vi.mock('@ai-sdk/react', () => ({
  useChat: (opts: {
    onFinish?: (opts: { message: UIMessage }) => void
    onError?: (err: Error) => void
  }) => {
    capturedOnFinish = opts.onFinish
    return {
      messages: mockMessages,
      setMessages: mockSetMessages,
      sendMessage: mockSendMessage,
      stop: mockStop,
      status: mockStatus,
      error: mockError,
      clearError: mockClearError,
    }
  },
}))

vi.mock('ai', () => ({
  DefaultChatTransport: class MockDefaultChatTransport {
    constructor() {
      // no-op mock constructor
    }
  },
}))

const defaultStoreState = {
  activeConversationId: null,
  sidebarOpen: false,
  streamingStatus: {
    claude: false,
    chatgpt: false,
    gemini: false,
  },
}

beforeEach(async () => {
  mockMessages = []
  mockStatus = 'ready'
  mockError = undefined
  capturedOnFinish = undefined
  useAppStore.setState(defaultStoreState)
  await db.conversations.clear()
  await db.messages.clear()
  await db.settings.clear()
  vi.clearAllMocks()
})

afterAll(async () => {
  await db.delete()
})

// ---------------------------------------------------------------------------
// getMessageText — pure function tests
// ---------------------------------------------------------------------------

describe('getMessageText', () => {
  it('extracts text from a single text part', () => {
    const msg: UIMessage = {
      id: '1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Hello world' }],
    }
    expect(getMessageText(msg)).toBe('Hello world')
  })

  it('concatenates multiple text parts', () => {
    const msg: UIMessage = {
      id: '2',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ],
    }
    expect(getMessageText(msg)).toBe('Hello world')
  })

  it('filters out non-text parts', () => {
    const msg: UIMessage = {
      id: '3',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Kept' }],
    }
    expect(getMessageText(msg)).toBe('Kept')
  })

  it('returns empty string when parts array is empty', () => {
    const msg: UIMessage = {
      id: '5',
      role: 'user',
      parts: [],
    }
    expect(getMessageText(msg)).toBe('')
  })

  it('returns empty string when parts is undefined', () => {
    const msg = {
      id: '6',
      role: 'user' as const,
    } as UIMessage
    expect(getMessageText(msg)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// useProviderChat hook tests
// ---------------------------------------------------------------------------

describe('useProviderChat', () => {
  describe('streaming status sync', () => {
    it('sets streaming status to true when status is submitted', () => {
      mockStatus = 'submitted'
      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      expect(useAppStore.getState().streamingStatus.claude).toBe(true)
    })

    it('sets streaming status to true when status is streaming', () => {
      mockStatus = 'streaming'
      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      expect(useAppStore.getState().streamingStatus.claude).toBe(true)
    })

    it('sets streaming status to false when status is ready', () => {
      // First set it to true
      useAppStore.getState().setStreamingStatus('claude', true)
      mockStatus = 'ready'

      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      expect(useAppStore.getState().streamingStatus.claude).toBe(false)
    })

    it('sets streaming status to false when status is error', () => {
      useAppStore.getState().setStreamingStatus('gemini', true)
      mockStatus = 'error'

      renderHook(() =>
        useProviderChat({
          provider: 'gemini',
          conversationId: 1,
          model: 'gemini-3-flash-preview',
        }),
      )

      expect(useAppStore.getState().streamingStatus.gemini).toBe(false)
    })

    it('updates the correct provider in streaming status', () => {
      mockStatus = 'streaming'
      renderHook(() =>
        useProviderChat({
          provider: 'chatgpt',
          conversationId: 1,
          model: 'gpt-5.2',
        }),
      )

      expect(useAppStore.getState().streamingStatus.chatgpt).toBe(true)
      expect(useAppStore.getState().streamingStatus.claude).toBe(false)
      expect(useAppStore.getState().streamingStatus.gemini).toBe(false)
    })
  })

  describe('message seeding from Dexie', () => {
    it('seeds messages from Dexie when conversationId changes', async () => {
      // Add messages to Dexie for conversation 1
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'user',
        content: 'Hello from Dexie',
      })
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Hi back from Dexie',
      })

      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      await waitFor(() => {
        expect(mockSetMessages).toHaveBeenCalled()
      })

      // Verify the seeded messages have the correct structure
      const seededMessages = mockSetMessages.mock.calls[0][0] as UIMessage[]
      expect(seededMessages).toHaveLength(2)
      expect(seededMessages[0].role).toBe('user')
      expect(seededMessages[0].parts).toEqual([
        { type: 'text', text: 'Hello from Dexie' },
      ])
      expect(seededMessages[1].role).toBe('assistant')
      expect(seededMessages[1].parts).toEqual([
        { type: 'text', text: 'Hi back from Dexie' },
      ])
    })

    it('clears messages when conversationId becomes null', async () => {
      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: null,
          model: 'claude-sonnet-4-6',
        }),
      )

      await waitFor(() => {
        expect(mockSetMessages).toHaveBeenCalledWith([])
      })
    })

    it('only seeds messages for the matching provider', async () => {
      // Add messages for different providers in the same conversation
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'user',
        content: 'Claude message',
      })
      await addMessage({
        conversationId: 1,
        provider: 'chatgpt',
        role: 'user',
        content: 'ChatGPT message',
      })

      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      await waitFor(() => {
        expect(mockSetMessages).toHaveBeenCalled()
      })

      const seededMessages = mockSetMessages.mock.calls[0][0] as UIMessage[]
      expect(seededMessages).toHaveLength(1)
      expect(seededMessages[0].parts).toEqual([
        { type: 'text', text: 'Claude message' },
      ])
    })
  })

  describe('onFinish persistence', () => {
    it('persists assistant message to Dexie on finish', async () => {
      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      // Simulate onFinish being called by useChat
      expect(capturedOnFinish).toBeDefined()
      await act(async () => {
        await capturedOnFinish!({
          message: {
            id: 'msg-1',
            role: 'assistant',
            parts: [{ type: 'text', text: 'AI response content' }],
          },
        })
      })

      // Verify the message was persisted to Dexie
      const messages = await db.messages.toArray()
      // Filter for assistant messages (seeding may have added a setMessages call)
      const assistantMessages = messages.filter((m) => m.role === 'assistant')
      expect(assistantMessages).toHaveLength(1)
      expect(assistantMessages[0].content).toBe('AI response content')
      expect(assistantMessages[0].provider).toBe('claude')
      expect(assistantMessages[0].conversationId).toBe(1)
    })

    it('does not persist when conversationId is null', async () => {
      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: null,
          model: 'claude-sonnet-4-6',
        }),
      )

      expect(capturedOnFinish).toBeDefined()
      await act(async () => {
        await capturedOnFinish!({
          message: {
            id: 'msg-1',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Should not persist' }],
          },
        })
      })

      const messages = await db.messages.toArray()
      expect(messages).toHaveLength(0)
    })

    it('does not persist empty content', async () => {
      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      expect(capturedOnFinish).toBeDefined()
      await act(async () => {
        await capturedOnFinish!({
          message: {
            id: 'msg-1',
            role: 'assistant',
            parts: [],
          },
        })
      })

      const messages = await db.messages.toArray()
      expect(messages).toHaveLength(0)
    })
  })

  describe('send function', () => {
    it('returns false when conversationId is null', async () => {
      const { result } = renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: null,
          model: 'claude-sonnet-4-6',
        }),
      )

      let sent: boolean = false
      await act(async () => {
        sent = await result.current.send('Hello')
      })
      expect(sent).toBe(false)
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('returns false for empty or whitespace-only text', async () => {
      const { result } = renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      let sent: boolean = false
      await act(async () => {
        sent = await result.current.send('   ')
      })
      expect(sent).toBe(false)
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('returns false when status is not ready', async () => {
      mockStatus = 'streaming'
      const { result } = renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      let sent: boolean = false
      await act(async () => {
        sent = await result.current.send('Hello')
      })
      expect(sent).toBe(false)
    })

    it('persists user message to Dexie and calls sendMessage', async () => {
      mockStatus = 'ready'
      const { result } = renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      let sent: boolean = false
      await act(async () => {
        sent = await result.current.send('Hello Claude!')
      })

      expect(sent).toBe(true)

      // Verify user message was persisted to Dexie
      const messages = await db.messages.toArray()
      const userMessages = messages.filter((m) => m.role === 'user')
      expect(userMessages).toHaveLength(1)
      expect(userMessages[0].content).toBe('Hello Claude!')
      expect(userMessages[0].provider).toBe('claude')
      expect(userMessages[0].conversationId).toBe(1)

      // Verify sendMessage was called with the trimmed text
      expect(mockSendMessage).toHaveBeenCalledWith({ text: 'Hello Claude!' })
    })

    it('trims whitespace from the message before sending', async () => {
      const { result } = renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      await act(async () => {
        await result.current.send('  Hello  ')
      })

      // Verify it was saved trimmed
      const messages = await db.messages.toArray()
      expect(messages[0].content).toBe('Hello')
      expect(mockSendMessage).toHaveBeenCalledWith({ text: 'Hello' })
    })
  })

  describe('token count extraction on onFinish', () => {
    it('extracts token count from message metadata usage', async () => {
      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      expect(capturedOnFinish).toBeDefined()
      await act(async () => {
        await capturedOnFinish!({
          message: {
            id: 'msg-tokens-1',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Response with tokens' }],
            metadata: {
              usage: {
                inputTokens: 150,
                outputTokens: 300,
              },
            },
          } as UIMessage,
        })
      })

      // Verify token count was persisted to Dexie
      const messages = await db.messages.toArray()
      const assistantMsg = messages.find((m) => m.role === 'assistant')
      expect(assistantMsg).toBeDefined()
      expect(assistantMsg!.tokenCount).toEqual({ input: 150, output: 300 })
    })

    it('persists tokenCount as null when metadata has no usage', async () => {
      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      expect(capturedOnFinish).toBeDefined()
      await act(async () => {
        await capturedOnFinish!({
          message: {
            id: 'msg-no-tokens',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Response without tokens' }],
            // No metadata
          },
        })
      })

      const messages = await db.messages.toArray()
      const assistantMsg = messages.find((m) => m.role === 'assistant')
      expect(assistantMsg).toBeDefined()
      expect(assistantMsg!.tokenCount).toBeNull()
    })

    it('persists tokenCount as null when metadata is undefined', async () => {
      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      expect(capturedOnFinish).toBeDefined()
      await act(async () => {
        await capturedOnFinish!({
          message: {
            id: 'msg-undef-meta',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Response' }],
            metadata: undefined,
          } as UIMessage,
        })
      })

      const messages = await db.messages.toArray()
      const assistantMsg = messages.find((m) => m.role === 'assistant')
      expect(assistantMsg).toBeDefined()
      expect(assistantMsg!.tokenCount).toBeNull()
    })

    it('handles partial usage metadata (only inputTokens)', async () => {
      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      expect(capturedOnFinish).toBeDefined()
      await act(async () => {
        await capturedOnFinish!({
          message: {
            id: 'msg-partial',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Partial usage' }],
            metadata: {
              usage: {
                inputTokens: 200,
                // outputTokens missing
              },
            },
          } as UIMessage,
        })
      })

      const messages = await db.messages.toArray()
      const assistantMsg = messages.find((m) => m.role === 'assistant')
      expect(assistantMsg).toBeDefined()
      expect(assistantMsg!.tokenCount).toEqual({ input: 200, output: 0 })
    })

    it('handles partial usage metadata (only outputTokens)', async () => {
      renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      expect(capturedOnFinish).toBeDefined()
      await act(async () => {
        await capturedOnFinish!({
          message: {
            id: 'msg-partial-out',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Partial output' }],
            metadata: {
              usage: {
                outputTokens: 500,
                // inputTokens missing
              },
            },
          } as UIMessage,
        })
      })

      const messages = await db.messages.toArray()
      const assistantMsg = messages.find((m) => m.role === 'assistant')
      expect(assistantMsg).toBeDefined()
      expect(assistantMsg!.tokenCount).toEqual({ input: 0, output: 500 })
    })

    it('updates tokenCountMap state after onFinish with token data', async () => {
      const { result } = renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      expect(capturedOnFinish).toBeDefined()
      await act(async () => {
        await capturedOnFinish!({
          message: {
            id: 'msg-map-test',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Token map test' }],
            metadata: {
              usage: {
                inputTokens: 100,
                outputTokens: 200,
              },
            },
          } as UIMessage,
        })
      })

      // The tokenCountMap should contain the entry
      expect(result.current.tokenCountMap.get('msg-map-test')).toEqual({
        input: 100,
        output: 200,
      })
    })

    it('does not update tokenCountMap when there is no token data', async () => {
      const { result } = renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      expect(capturedOnFinish).toBeDefined()
      await act(async () => {
        await capturedOnFinish!({
          message: {
            id: 'msg-no-map',
            role: 'assistant',
            parts: [{ type: 'text', text: 'No token data' }],
          },
        })
      })

      expect(result.current.tokenCountMap.has('msg-no-map')).toBe(false)
    })
  })

  describe('token count seeding from Dexie', () => {
    it('populates tokenCountMap when seeding messages from Dexie', async () => {
      // Add a message with token count to Dexie
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Response with tokens',
        tokenCount: { input: 250, output: 500 },
      })

      const { result } = renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      await waitFor(() => {
        expect(mockSetMessages).toHaveBeenCalled()
      })

      // The tokenCountMap should be populated from the seeded messages
      expect(result.current.tokenCountMap.size).toBe(1)
      const firstEntry = Array.from(result.current.tokenCountMap.values())[0]
      expect(firstEntry).toEqual({ input: 250, output: 500 })
    })

    it('does not include messages without tokenCount in tokenCountMap', async () => {
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Response without tokens',
        // tokenCount defaults to null
      })

      const { result } = renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )

      await waitFor(() => {
        expect(mockSetMessages).toHaveBeenCalled()
      })

      expect(result.current.tokenCountMap.size).toBe(0)
    })

    it('clears tokenCountMap when conversationId becomes null', async () => {
      // Seed with token data first
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Response',
        tokenCount: { input: 100, output: 200 },
      })

      const { result, rerender } = renderHook(
        ({ conversationId }: { conversationId: number | null }) =>
          useProviderChat({
            provider: 'claude',
            conversationId,
            model: 'claude-sonnet-4-6',
          }),
        { initialProps: { conversationId: 1 as number | null } },
      )

      await waitFor(() => {
        expect(result.current.tokenCountMap.size).toBe(1)
      })

      // Switch to null conversation
      rerender({ conversationId: null })

      await waitFor(() => {
        expect(result.current.tokenCountMap.size).toBe(0)
      })
    })
  })

  describe('return values', () => {
    it('exposes isLoading derived from status', () => {
      mockStatus = 'ready'
      const { result, rerender } = renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )
      expect(result.current.isLoading).toBe(false)

      mockStatus = 'submitted'
      rerender()
      expect(result.current.isLoading).toBe(true)

      mockStatus = 'streaming'
      rerender()
      expect(result.current.isLoading).toBe(true)

      mockStatus = 'error'
      rerender()
      expect(result.current.isLoading).toBe(false)
    })

    it('exposes stop and clearError from useChat', () => {
      const { result } = renderHook(() =>
        useProviderChat({
          provider: 'claude',
          conversationId: 1,
          model: 'claude-sonnet-4-6',
        }),
      )
      expect(result.current.stop).toBeDefined()
      expect(result.current.clearError).toBeDefined()
    })
  })
})
