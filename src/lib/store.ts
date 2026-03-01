/**
 * Zustand store for ephemeral application state.
 *
 * Manages UI state that does not need to persist to IndexedDB:
 * - Active conversation selection
 * - Sidebar open/close state
 * - Selected models per provider (synced from Dexie on load)
 * - Theme preference
 */

import { create } from 'zustand'
import type { Provider, SelectedModels, Theme } from '@/lib/db/types'
import { DEFAULT_MODELS } from '@/lib/models'

/** Per-provider streaming status. */
export type StreamingStatus = Record<Provider, boolean>

interface AppState {
  /** Currently active conversation ID, or null if no conversation is selected. */
  activeConversationId: number | null
  /** Whether the conversation sidebar is open. */
  sidebarOpen: boolean
  /** Per-provider model selection. */
  selectedModels: SelectedModels
  /** Current color theme. */
  theme: Theme
  /** Per-provider streaming state (true = currently streaming or submitted). */
  streamingStatus: StreamingStatus
}

interface AppActions {
  /** Set the active conversation. Pass null to deselect. */
  setActiveConversationId: (id: number | null) => void
  /** Toggle the sidebar open/closed. */
  toggleSidebar: () => void
  /** Set the sidebar open state explicitly. */
  setSidebarOpen: (open: boolean) => void
  /** Update the selected model for a specific provider. */
  setSelectedModel: (provider: Provider, model: string) => void
  /** Set all selected models at once (e.g., when loading from Dexie). */
  setSelectedModels: (models: SelectedModels) => void
  /** Set the color theme. */
  setTheme: (theme: Theme) => void
  /** Update streaming status for a specific provider. */
  setStreamingStatus: (provider: Provider, isStreaming: boolean) => void
}

export type AppStore = AppState & AppActions

export const useAppStore = create<AppStore>()((set) => ({
  // State
  activeConversationId: null,
  sidebarOpen: true,
  selectedModels: { ...DEFAULT_MODELS },
  theme: 'dark',
  streamingStatus: {
    claude: false,
    chatgpt: false,
    gemini: false,
  },

  // Actions
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSelectedModel: (provider, model) =>
    set((state) => ({
      selectedModels: { ...state.selectedModels, [provider]: model },
    })),
  setSelectedModels: (models) => set({ selectedModels: models }),
  setTheme: (theme) => set({ theme }),
  setStreamingStatus: (provider, isStreaming) =>
    set((state) => ({
      streamingStatus: { ...state.streamingStatus, [provider]: isStreaming },
    })),
}))
