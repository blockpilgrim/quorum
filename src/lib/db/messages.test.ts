/**
 * Minimal tests for message data access functions.
 * Uses fake-indexeddb for IndexedDB in jsdom.
 */

import 'fake-indexeddb/auto'

import { db } from '@/lib/db/schema'
import type { ModelConfig } from '@/lib/db/types'

import { createConversation } from './conversations'
import {
  addMessage,
  getMessagesByConversation,
  getMessagesByThread,
} from './messages'

const defaultModelConfig: ModelConfig = {
  claude: 'claude-sonnet-4-20250514',
  chatgpt: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
}

async function createTestConversation(): Promise<number> {
  return createConversation({ modelConfig: defaultModelConfig })
}

beforeEach(async () => {
  await db.conversations.clear()
  await db.messages.clear()
  await db.settings.clear()
})

afterAll(async () => {
  await db.delete()
})

describe('addMessage', () => {
  it('returns an id and sets correct defaults', async () => {
    const convId = await createTestConversation()
    const id = await addMessage({
      conversationId: convId,
      provider: 'claude',
      role: 'user',
      content: 'Hello',
    })
    expect(id).toBeGreaterThan(0)

    const msg = await db.messages.get(id)
    expect(msg!.tokenCount).toBeNull()
    expect(msg!.isCrossFeed).toBe(false)
    expect(msg!.crossFeedRound).toBeNull()
  })
})

describe('getMessagesByThread', () => {
  it('filters by conversation + provider and orders by timestamp', async () => {
    const convId = await createTestConversation()

    await addMessage({
      conversationId: convId,
      provider: 'claude',
      role: 'user',
      content: 'Claude msg',
    })
    await addMessage({
      conversationId: convId,
      provider: 'chatgpt',
      role: 'user',
      content: 'ChatGPT msg',
    })

    const claudeMsgs = await getMessagesByThread(convId, 'claude')
    expect(claudeMsgs).toHaveLength(1)
    expect(claudeMsgs[0].content).toBe('Claude msg')

    const chatgptMsgs = await getMessagesByThread(convId, 'chatgpt')
    expect(chatgptMsgs).toHaveLength(1)
    expect(chatgptMsgs[0].content).toBe('ChatGPT msg')
  })

  it('returns empty array when no messages exist', async () => {
    const convId = await createTestConversation()
    expect(await getMessagesByThread(convId, 'claude')).toEqual([])
  })
})

describe('getMessagesByConversation', () => {
  it('returns all messages across providers ordered by timestamp', async () => {
    const convId = await createTestConversation()

    await addMessage({
      conversationId: convId,
      provider: 'claude',
      role: 'user',
      content: 'Claude',
    })
    await new Promise((r) => setTimeout(r, 10))
    await addMessage({
      conversationId: convId,
      provider: 'chatgpt',
      role: 'user',
      content: 'ChatGPT',
    })
    await new Promise((r) => setTimeout(r, 10))
    await addMessage({
      conversationId: convId,
      provider: 'gemini',
      role: 'user',
      content: 'Gemini',
    })

    const messages = await getMessagesByConversation(convId)
    expect(messages).toHaveLength(3)
    expect(messages[0].content).toBe('Claude')
    expect(messages[2].content).toBe('Gemini')
  })
})
