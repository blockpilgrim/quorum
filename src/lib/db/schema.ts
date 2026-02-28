/**
 * Dexie database schema definition for Cortex.
 *
 * Exports a singleton `db` instance. All data access functions import from here.
 */

import Dexie, { type Table } from 'dexie'

import type { Conversation, Message, Settings } from '@/lib/db/types'

class CortexDatabase extends Dexie {
  conversations!: Table<Conversation, number>
  messages!: Table<Message, number>
  settings!: Table<Settings, number>

  constructor() {
    super('cortex')

    this.version(1).stores({
      // Auto-increment `id` (++), index `createdAt` and `updatedAt` for sorting
      conversations: '++id, createdAt, updatedAt',

      // Auto-increment `id` (++), compound index for per-thread queries,
      // plus individual indexes for common lookups
      messages:
        '++id, conversationId, [conversationId+provider+timestamp], timestamp',

      // Fixed id (not auto-increment) — singleton record with id=1
      settings: 'id',
    })
  }
}

/** Singleton database instance. */
export const db = new CortexDatabase()
