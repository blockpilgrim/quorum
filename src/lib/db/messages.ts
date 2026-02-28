/**
 * Data access functions for the `messages` table.
 */

import Dexie from 'dexie'

import { db } from '@/lib/db/schema'
import type { AddMessageInput, Message, Provider } from '@/lib/db/types'

/**
 * Add a new message and return its auto-generated id.
 *
 * Sets `timestamp` to the current time. Defaults `tokenCount` to null,
 * `isCrossFeed` to false, and `crossFeedRound` to null if not provided.
 */
export async function addMessage(input: AddMessageInput): Promise<number> {
  const message: Message = {
    conversationId: input.conversationId,
    provider: input.provider,
    role: input.role,
    content: input.content,
    timestamp: new Date().toISOString(),
    tokenCount: input.tokenCount ?? null,
    isCrossFeed: input.isCrossFeed ?? false,
    crossFeedRound: input.crossFeedRound ?? null,
  }
  return db.messages.add(message)
}

/**
 * Get messages for a specific thread (conversation + provider), ordered by
 * timestamp ascending.
 *
 * Uses the compound index `[conversationId+provider+timestamp]` for
 * efficient retrieval.
 */
export async function getMessagesByThread(
  conversationId: number,
  provider: Provider,
): Promise<Message[]> {
  return db.messages
    .where('[conversationId+provider+timestamp]')
    .between(
      [conversationId, provider, Dexie.minKey],
      [conversationId, provider, Dexie.maxKey],
    )
    .toArray()
}

/**
 * Get all messages for a conversation across all providers, ordered by
 * timestamp ascending.
 */
export async function getMessagesByConversation(
  conversationId: number,
): Promise<Message[]> {
  return db.messages
    .where('conversationId')
    .equals(conversationId)
    .sortBy('timestamp')
}
