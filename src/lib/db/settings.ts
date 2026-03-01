/**
 * Data access functions for the `settings` table.
 *
 * Settings is a singleton record (always id=1). If no record exists,
 * `getSettings` returns a default settings object.
 */

import { db } from '@/lib/db/schema'
import type { Settings, UpdateSettingsInput } from '@/lib/db/types'

/** Default settings used when no record exists yet. */
const DEFAULT_SETTINGS: Settings = {
  id: 1,
  apiKeys: {
    claude: '',
    chatgpt: '',
    gemini: '',
  },
  selectedModels: {
    claude: 'claude-sonnet-4-6',
    chatgpt: 'gpt-5.2',
    gemini: 'gemini-3-flash-preview',
  },
  theme: 'dark',
}

/**
 * Get the current settings. Returns default settings if none have been
 * persisted yet (first run).
 */
export async function getSettings(): Promise<Settings> {
  const record = await db.settings.get(1)
  if (record) return record

  // First run — persist defaults so future reads hit the DB
  await db.settings.put({ ...DEFAULT_SETTINGS })
  return { ...DEFAULT_SETTINGS }
}

/**
 * Update settings with a partial input.
 *
 * Merges nested objects (`apiKeys`, `selectedModels`) so callers can
 * update a single provider key without overwriting the others.
 */
export async function updateSettings(
  input: UpdateSettingsInput,
): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getSettings()

    const merged: Partial<Settings> = {}

    if (input.apiKeys !== undefined) {
      merged.apiKeys = { ...current.apiKeys, ...input.apiKeys }
    }

    if (input.selectedModels !== undefined) {
      merged.selectedModels = {
        ...current.selectedModels,
        ...input.selectedModels,
      }
    }

    if (input.theme !== undefined) {
      merged.theme = input.theme
    }

    await db.settings.update(1, merged)
  })
}
