/**
 * Minimal tests for settings data access functions.
 * Uses fake-indexeddb for IndexedDB in jsdom.
 */

import 'fake-indexeddb/auto'

import { clearAllTables, deleteDatabase } from '@/test/db-helpers'

import { getSettings, updateSettings } from './settings'

beforeEach(async () => {
  await clearAllTables()
})

afterAll(async () => {
  await deleteDatabase()
})

describe('settings', () => {
  it('returns defaults on first run', async () => {
    const settings = await getSettings()
    expect(settings.apiKeys).toEqual({
      claude: '',
      chatgpt: '',
      gemini: '',
      openrouter: '',
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
      selectedModels: { claude: 'claude-opus-4-6' },
      theme: 'light',
    })
    await updateSettings({ apiKeys: { claude: 'key-updated' } })

    const settings = await getSettings()
    expect(settings.apiKeys.claude).toBe('key-updated')
    expect(settings.apiKeys.chatgpt).toBe('key-2')
    expect(settings.selectedModels.claude).toBe('claude-opus-4-6')
    expect(settings.theme).toBe('light')
  })
})
