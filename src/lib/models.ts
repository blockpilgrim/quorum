/**
 * Model definitions and display names for all supported AI providers.
 *
 * Each provider has a list of available models with their API IDs and
 * human-readable display names. The default model per provider matches
 * the defaults in the Zustand store and Dexie settings.
 */

import type { Provider } from '@/lib/db/types'

export interface ModelOption {
  /** Model ID sent to the proxy (e.g., 'claude-sonnet-4-6'). */
  id: string
  /** Human-readable label for the UI (e.g., 'Sonnet 4'). */
  label: string
}

/** Available models per provider, ordered by preference (default first). */
export const MODEL_OPTIONS: Record<Provider, ModelOption[]> = {
  claude: [
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
    { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  ],
  chatgpt: [
    { id: 'gpt-5.2', label: 'GPT-5.2' },
    { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
  ],
  gemini: [
    { id: 'gemini-3-flash-preview', label: '3 Flash' },
    { id: 'gemini-3.1-pro-preview', label: '3.1 Pro' },
  ],
}

/** Flat map from model ID to display name for quick lookups. */
export const MODEL_DISPLAY_NAMES: Record<string, string> = Object.values(
  MODEL_OPTIONS,
)
  .flat()
  .reduce(
    (acc, opt) => {
      acc[opt.id] = opt.label
      return acc
    },
    {} as Record<string, string>,
  )

/**
 * Get the display name for a model ID.
 * Falls back to the raw ID if no display name is registered.
 */
export function getModelDisplayName(modelId: string): string {
  return MODEL_DISPLAY_NAMES[modelId] ?? modelId
}

/** Provider display labels used throughout the UI. */
export const PROVIDER_LABELS: Record<Provider, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
}

/** Provider-specific accent colors for column headers and settings. */
export const PROVIDER_COLORS: Record<Provider, string> = {
  claude: 'bg-chart-1',
  chatgpt: 'bg-chart-2',
  gemini: 'bg-chart-3',
}
