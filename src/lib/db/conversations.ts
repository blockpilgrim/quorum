/**
 * Data access functions for the `conversations` table.
 */

import { db } from '@/lib/db/schema'
import type {
  Conversation,
  CreateConversationInput,
  UpdateConversationInput,
} from '@/lib/db/types'

/**
 * Create a new conversation and return its auto-generated id.
 *
 * Sets `createdAt` and `updatedAt` to the current time.
 * If no title is provided, defaults to "New Conversation".
 */
export async function createConversation(
  input: CreateConversationInput,
): Promise<number> {
  const now = new Date().toISOString()
  const conversation: Conversation = {
    title: input.title ?? 'New Conversation',
    createdAt: now,
    updatedAt: now,
    modelConfig: input.modelConfig,
  }
  return db.conversations.add(conversation)
}

/**
 * Get a single conversation by id.
 *
 * Returns `undefined` if the conversation does not exist.
 */
export async function getConversation(
  id: number,
): Promise<Conversation | undefined> {
  return db.conversations.get(id)
}

/**
 * List all conversations, ordered by most recently updated first.
 */
export async function listConversations(): Promise<Conversation[]> {
  return db.conversations.orderBy('updatedAt').reverse().toArray()
}

/**
 * Update an existing conversation.
 *
 * Automatically bumps `updatedAt`. Only the provided fields are changed.
 * Returns the number of records updated (0 if the id was not found).
 */
export async function updateConversation(
  id: number,
  input: UpdateConversationInput,
): Promise<number> {
  const updates: Partial<Conversation> = {
    updatedAt: new Date().toISOString(),
  }

  if (input.title !== undefined) {
    updates.title = input.title
  }
  if (input.modelConfig !== undefined) {
    updates.modelConfig = input.modelConfig
  }

  return db.conversations.update(id, updates)
}

/**
 * Delete a conversation and all its associated messages.
 *
 * Uses a Dexie transaction to ensure atomicity — either both the
 * conversation and its messages are deleted, or neither is.
 */
export async function deleteConversation(id: number): Promise<void> {
  await db.transaction('rw', db.conversations, db.messages, async () => {
    await db.messages.where('conversationId').equals(id).delete()
    await db.conversations.delete(id)
  })
}
