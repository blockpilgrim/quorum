/**
 * Public API for the Cortex data layer.
 *
 * Import from `@/lib/db` to access all types and data access functions.
 */

// Database instance (for advanced usage like useLiveQuery)
export { db } from '@/lib/db/schema'

// Types
export type {
  AddMessageInput,
  ApiKeys,
  Conversation,
  CreateConversationInput,
  Message,
  MessageRole,
  ModelConfig,
  Provider,
  SelectedModels,
  Settings,
  Theme,
  TokenCount,
  UpdateConversationInput,
  UpdateSettingsInput,
} from '@/lib/db/types'

// Conversation operations
export {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  updateConversation,
} from '@/lib/db/conversations'

// Message operations
export {
  addMessage,
  getMessagesByConversation,
  getMessagesByThread,
} from '@/lib/db/messages'

// Settings operations
export { getSettings, updateSettings } from '@/lib/db/settings'
