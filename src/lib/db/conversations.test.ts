/**
 * Minimal tests for conversation data access functions.
 * Uses fake-indexeddb for IndexedDB in jsdom.
 */

import 'fake-indexeddb/auto'

import { db } from '@/lib/db/schema'
import type { ModelConfig } from '@/lib/db/types'

import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  updateConversation,
} from './conversations'
import { addMessage } from './messages'

const defaultModelConfig: ModelConfig = {
  claude: 'claude-sonnet-4-6',
  chatgpt: 'gpt-5.2',
  gemini: 'gemini-3-flash-preview',
}

beforeEach(async () => {
  await db.conversations.clear()
  await db.messages.clear()
  await db.settings.clear()
})

afterAll(async () => {
  await db.delete()
})

describe('createConversation', () => {
  it('returns an id and defaults title to "New Conversation"', async () => {
    const id = await createConversation({ modelConfig: defaultModelConfig })
    expect(id).toBeGreaterThan(0)

    const conv = await db.conversations.get(id)
    expect(conv?.title).toBe('New Conversation')
    expect(conv?.modelConfig).toEqual(defaultModelConfig)
  })

  it('uses a provided title', async () => {
    const id = await createConversation({
      title: 'Custom',
      modelConfig: defaultModelConfig,
    })
    const conv = await db.conversations.get(id)
    expect(conv?.title).toBe('Custom')
  })
})

describe('getConversation', () => {
  it('retrieves by id or returns undefined for non-existent', async () => {
    const id = await createConversation({
      title: 'Test',
      modelConfig: defaultModelConfig,
    })
    expect((await getConversation(id))?.title).toBe('Test')
    expect(await getConversation(99999)).toBeUndefined()
  })
})

describe('listConversations', () => {
  it('returns conversations ordered by updatedAt descending', async () => {
    await createConversation({
      title: 'First',
      modelConfig: defaultModelConfig,
    })
    await new Promise((r) => setTimeout(r, 10))
    const id2 = await createConversation({
      title: 'Second',
      modelConfig: defaultModelConfig,
    })

    const conversations = await listConversations()
    expect(conversations[0].id).toBe(id2)
  })
})

describe('updateConversation', () => {
  it('updates title and bumps updatedAt', async () => {
    const id = await createConversation({
      title: 'Original',
      modelConfig: defaultModelConfig,
    })
    const original = await getConversation(id)

    await new Promise((r) => setTimeout(r, 10))
    await updateConversation(id, { title: 'Updated' })

    const conv = await getConversation(id)
    expect(conv!.title).toBe('Updated')
    expect(conv!.updatedAt > original!.updatedAt).toBe(true)
  })
})

describe('deleteConversation', () => {
  it('removes conversation and cascade-deletes messages', async () => {
    const id = await createConversation({ modelConfig: defaultModelConfig })
    await addMessage({
      conversationId: id,
      provider: 'claude',
      role: 'user',
      content: 'Hello',
    })
    await addMessage({
      conversationId: id,
      provider: 'chatgpt',
      role: 'user',
      content: 'Hello',
    })

    await deleteConversation(id)

    expect(await getConversation(id)).toBeUndefined()
    expect(await db.messages.where('conversationId').equals(id).count()).toBe(0)
  })

  it('does not delete messages from other conversations', async () => {
    const id1 = await createConversation({ modelConfig: defaultModelConfig })
    const id2 = await createConversation({ modelConfig: defaultModelConfig })
    await addMessage({
      conversationId: id1,
      provider: 'claude',
      role: 'user',
      content: 'Conv 1',
    })
    await addMessage({
      conversationId: id2,
      provider: 'claude',
      role: 'user',
      content: 'Conv 2',
    })

    await deleteConversation(id1)
    expect(await db.messages.where('conversationId').equals(id2).count()).toBe(
      1,
    )
  })
})
