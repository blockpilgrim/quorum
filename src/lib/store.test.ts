/**
 * Minimal tests for the Zustand store.
 */

import { useAppStore } from '@/lib/store'

const defaultState = {
  activeConversationId: null,
  sidebarOpen: true,
  selectedModels: {
    claude: 'claude-sonnet-4-20250514',
    chatgpt: 'gpt-4o',
    gemini: 'gemini-2.0-flash',
  },
  theme: 'dark' as const,
  streamingStatus: {
    claude: false,
    chatgpt: false,
    gemini: false,
  },
}

beforeEach(() => {
  useAppStore.setState(defaultState)
})

describe('Zustand store', () => {
  it('has correct default state', () => {
    const state = useAppStore.getState()
    expect(state.activeConversationId).toBeNull()
    expect(state.sidebarOpen).toBe(true)
    expect(state.theme).toBe('dark')
    expect(state.selectedModels.claude).toBe('claude-sonnet-4-20250514')
  })

  it('sets active conversation id', () => {
    useAppStore.getState().setActiveConversationId(42)
    expect(useAppStore.getState().activeConversationId).toBe(42)

    useAppStore.getState().setActiveConversationId(null)
    expect(useAppStore.getState().activeConversationId).toBeNull()
  })

  it('toggles sidebar', () => {
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarOpen).toBe(false)

    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarOpen).toBe(true)
  })

  it('updates a single model without affecting others', () => {
    useAppStore.getState().setSelectedModel('claude', 'claude-opus-4-20250514')
    const { selectedModels } = useAppStore.getState()
    expect(selectedModels.claude).toBe('claude-opus-4-20250514')
    expect(selectedModels.chatgpt).toBe('gpt-4o')
    expect(selectedModels.gemini).toBe('gemini-2.0-flash')
  })

  describe('streamingStatus', () => {
    it('has all providers set to false by default', () => {
      const { streamingStatus } = useAppStore.getState()
      expect(streamingStatus.claude).toBe(false)
      expect(streamingStatus.chatgpt).toBe(false)
      expect(streamingStatus.gemini).toBe(false)
    })

    it('sets streaming status for a single provider', () => {
      useAppStore.getState().setStreamingStatus('claude', true)
      const { streamingStatus } = useAppStore.getState()
      expect(streamingStatus.claude).toBe(true)
      expect(streamingStatus.chatgpt).toBe(false)
      expect(streamingStatus.gemini).toBe(false)
    })

    it('sets streaming status for multiple providers independently', () => {
      useAppStore.getState().setStreamingStatus('claude', true)
      useAppStore.getState().setStreamingStatus('gemini', true)
      const { streamingStatus } = useAppStore.getState()
      expect(streamingStatus.claude).toBe(true)
      expect(streamingStatus.chatgpt).toBe(false)
      expect(streamingStatus.gemini).toBe(true)
    })

    it('toggles streaming status off for a provider', () => {
      useAppStore.getState().setStreamingStatus('chatgpt', true)
      expect(useAppStore.getState().streamingStatus.chatgpt).toBe(true)

      useAppStore.getState().setStreamingStatus('chatgpt', false)
      expect(useAppStore.getState().streamingStatus.chatgpt).toBe(false)
    })

    it('does not affect other state when setting streaming status', () => {
      useAppStore.getState().setActiveConversationId(42)
      useAppStore.getState().setStreamingStatus('claude', true)

      const state = useAppStore.getState()
      expect(state.activeConversationId).toBe(42)
      expect(state.sidebarOpen).toBe(true)
      expect(state.streamingStatus.claude).toBe(true)
    })
  })
})
