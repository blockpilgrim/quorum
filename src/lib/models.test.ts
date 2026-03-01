/**
 * Unit tests for model constants and utilities.
 */

import {
  MODEL_OPTIONS,
  MODEL_DISPLAY_NAMES,
  PROVIDER_LABELS,
  getModelDisplayName,
} from '@/lib/models'

describe('MODEL_OPTIONS', () => {
  it('has entries for all three providers', () => {
    expect(MODEL_OPTIONS.claude).toBeDefined()
    expect(MODEL_OPTIONS.chatgpt).toBeDefined()
    expect(MODEL_OPTIONS.gemini).toBeDefined()
  })

  it('has at least one model per provider', () => {
    expect(MODEL_OPTIONS.claude.length).toBeGreaterThanOrEqual(1)
    expect(MODEL_OPTIONS.chatgpt.length).toBeGreaterThanOrEqual(1)
    expect(MODEL_OPTIONS.gemini.length).toBeGreaterThanOrEqual(1)
  })

  it('each model has an id and label', () => {
    for (const provider of ['claude', 'chatgpt', 'gemini'] as const) {
      for (const model of MODEL_OPTIONS[provider]) {
        expect(model.id).toBeTruthy()
        expect(model.label).toBeTruthy()
        expect(typeof model.id).toBe('string')
        expect(typeof model.label).toBe('string')
      }
    }
  })

  it('has no duplicate model IDs within a provider', () => {
    for (const provider of ['claude', 'chatgpt', 'gemini'] as const) {
      const ids = MODEL_OPTIONS[provider].map((m) => m.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('MODEL_DISPLAY_NAMES', () => {
  it('contains all model entries from MODEL_OPTIONS', () => {
    const allModels = Object.values(MODEL_OPTIONS).flat()
    for (const model of allModels) {
      expect(MODEL_DISPLAY_NAMES[model.id]).toBe(model.label)
    }
  })

  it('has the same count as total models across all providers', () => {
    const totalModels = Object.values(MODEL_OPTIONS).flat().length
    expect(Object.keys(MODEL_DISPLAY_NAMES).length).toBe(totalModels)
  })
})

describe('getModelDisplayName', () => {
  it('returns the correct display name for known model IDs', () => {
    expect(getModelDisplayName('claude-sonnet-4-20250514')).toBe('Sonnet 4')
    expect(getModelDisplayName('gpt-4o')).toBe('GPT-4o')
    expect(getModelDisplayName('gemini-2.0-flash')).toBe('2.0 Flash')
  })

  it('returns the raw ID for unknown model IDs (fallback)', () => {
    expect(getModelDisplayName('unknown-model-xyz')).toBe('unknown-model-xyz')
    expect(getModelDisplayName('')).toBe('')
  })

  it('returns correct names for all models in MODEL_OPTIONS', () => {
    for (const models of Object.values(MODEL_OPTIONS)) {
      for (const model of models) {
        expect(getModelDisplayName(model.id)).toBe(model.label)
      }
    }
  })
})

describe('PROVIDER_LABELS', () => {
  it('maps all three providers to display names', () => {
    expect(PROVIDER_LABELS.claude).toBe('Claude')
    expect(PROVIDER_LABELS.chatgpt).toBe('ChatGPT')
    expect(PROVIDER_LABELS.gemini).toBe('Gemini')
  })

  it('has exactly three entries', () => {
    expect(Object.keys(PROVIDER_LABELS).length).toBe(3)
  })
})
