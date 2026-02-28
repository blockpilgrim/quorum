/**
 * Minimal tests for settings data access functions.
 * Uses fake-indexeddb for IndexedDB in jsdom.
 */

import 'fake-indexeddb/auto'

import { db } from '@/lib/db/schema'

import { getSettings, updateSettings } from './settings'

beforeEach(async () => {
  await db.conversations.clear()
  await db.messages.clear()
  await db.settings.clear()
})

afterAll(async () => {
  await db.delete()
})

describe('settings', () => {
  it('returns defaults on first run', async () => {
    const settings = await getSettings()
    expect(settings.apiKeys).toEqual({
      claude: '',
      chatgpt: '',
      gemini: '',
    })
    expect(settings.theme).toBe('dark')
  })

  it('partial update preserves other fields', async () => {
    await updateSettings({ apiKeys: { claude: 'sk-ant-key' } })

    const settings = await getSettings()
    expect(settings.apiKeys.claude).toBe('sk-ant-key')
    expect(settings.apiKeys.chatgpt).toBe('')
    expect(settings.apiKeys.gemini).toBe('')
  })

  it('multiple updates merge correctly', async () => {
    await updateSettings({
      apiKeys: { claude: 'key-1', chatgpt: 'key-2', gemini: 'key-3' },
    })
    await updateSettings({
      selectedModels: { claude: 'claude-opus-4-20250514' },
      theme: 'light',
    })
    await updateSettings({ apiKeys: { claude: 'key-updated' } })

    const settings = await getSettings()
    expect(settings.apiKeys.claude).toBe('key-updated')
    expect(settings.apiKeys.chatgpt).toBe('key-2')
    expect(settings.selectedModels.claude).toBe('claude-opus-4-20250514')
    expect(settings.theme).toBe('light')
  })
})
