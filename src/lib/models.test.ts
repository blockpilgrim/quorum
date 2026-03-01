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

  it('contains the correct Claude model IDs', () => {
    const ids = MODEL_OPTIONS.claude.map((m) => m.id)
    expect(ids).toContain('claude-sonnet-4-6')
    expect(ids).toContain('claude-opus-4-6')
  })

  it('contains the correct ChatGPT model IDs', () => {
    const ids = MODEL_OPTIONS.chatgpt.map((m) => m.id)
    expect(ids).toContain('gpt-5.2')
    expect(ids).toContain('gpt-5.3-codex')
  })

  it('contains the correct Gemini model IDs', () => {
    const ids = MODEL_OPTIONS.gemini.map((m) => m.id)
    expect(ids).toContain('gemini-3-flash-preview')
    expect(ids).toContain('gemini-3.1-pro-preview')
  })

  it('has the default model first for each provider', () => {
    expect(MODEL_OPTIONS.claude[0].id).toBe('claude-sonnet-4-6')
    expect(MODEL_OPTIONS.chatgpt[0].id).toBe('gpt-5.2')
    expect(MODEL_OPTIONS.gemini[0].id).toBe('gemini-3-flash-preview')
  })

  it('does not contain deprecated model IDs', () => {
    const allIds = Object.values(MODEL_OPTIONS)
      .flat()
      .map((m) => m.id)
    const deprecated = [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-haiku-3-5-20241022',
      'gpt-4o',
      'gpt-4o-mini',
      'o1',
      'o3-mini',
      'gemini-2.0-flash',
      'gemini-2.5-pro-preview-06-05',
    ]
    for (const old of deprecated) {
      expect(allIds).not.toContain(old)
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
    expect(getModelDisplayName('claude-sonnet-4-6')).toBe('Sonnet 4.6')
    expect(getModelDisplayName('claude-opus-4-6')).toBe('Opus 4.6')
    expect(getModelDisplayName('gpt-5.2')).toBe('GPT-5.2')
    expect(getModelDisplayName('gpt-5.3-codex')).toBe('GPT-5.3 Codex')
    expect(getModelDisplayName('gemini-3-flash-preview')).toBe('3 Flash')
    expect(getModelDisplayName('gemini-3.1-pro-preview')).toBe('3.1 Pro')
  })

  it('falls back to raw ID for deprecated model IDs', () => {
    expect(getModelDisplayName('claude-sonnet-4-20250514')).toBe(
      'claude-sonnet-4-20250514',
    )
    expect(getModelDisplayName('gpt-4o')).toBe('gpt-4o')
    expect(getModelDisplayName('gemini-2.0-flash')).toBe('gemini-2.0-flash')
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
