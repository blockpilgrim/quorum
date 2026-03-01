/**
 * Unit tests for the pricing module.
 *
 * Tests cost calculation, formatting, and pricing table coverage.
 */

import {
  MODEL_PRICING,
  calculateCost,
  calculateTotalCost,
  formatCost,
  formatTokenCount,
} from '@/lib/pricing'

describe('MODEL_PRICING', () => {
  it('has pricing for all Claude models', () => {
    expect(MODEL_PRICING['claude-sonnet-4-20250514']).toBeDefined()
    expect(MODEL_PRICING['claude-opus-4-20250514']).toBeDefined()
    expect(MODEL_PRICING['claude-haiku-3-5-20241022']).toBeDefined()
  })

  it('has pricing for all OpenAI models', () => {
    expect(MODEL_PRICING['gpt-4o']).toBeDefined()
    expect(MODEL_PRICING['gpt-4o-mini']).toBeDefined()
    expect(MODEL_PRICING['o1']).toBeDefined()
    expect(MODEL_PRICING['o3-mini']).toBeDefined()
  })

  it('has pricing for all Gemini models', () => {
    expect(MODEL_PRICING['gemini-2.0-flash']).toBeDefined()
    expect(MODEL_PRICING['gemini-2.5-pro-preview-06-05']).toBeDefined()
  })

  it('has positive prices for all models', () => {
    for (const [, pricing] of Object.entries(MODEL_PRICING)) {
      expect(pricing.inputPer1M).toBeGreaterThan(0)
      expect(pricing.outputPer1M).toBeGreaterThan(0)
      // Output is generally more expensive than or equal to input
      expect(pricing.outputPer1M).toBeGreaterThanOrEqual(pricing.inputPer1M)
    }
  })
})

describe('calculateCost', () => {
  it('calculates cost for Claude Sonnet', () => {
    // 1000 input tokens at $3/1M = $0.003
    // 500 output tokens at $15/1M = $0.0075
    const cost = calculateCost('claude-sonnet-4-20250514', {
      input: 1000,
      output: 500,
    })
    expect(cost).toBeCloseTo(0.0105, 6)
  })

  it('calculates cost for Claude Opus', () => {
    // 1M input tokens at $15/1M = $15
    // 1M output tokens at $75/1M = $75
    const cost = calculateCost('claude-opus-4-20250514', {
      input: 1_000_000,
      output: 1_000_000,
    })
    expect(cost).toBeCloseTo(90, 2)
  })

  it('calculates cost for GPT-4o', () => {
    // 5000 input tokens at $2.50/1M = $0.0125
    // 2000 output tokens at $10/1M = $0.02
    const cost = calculateCost('gpt-4o', { input: 5000, output: 2000 })
    expect(cost).toBeCloseTo(0.0325, 6)
  })

  it('calculates cost for Gemini Flash (cheapest model)', () => {
    // 10000 input tokens at $0.10/1M = $0.001
    // 5000 output tokens at $0.40/1M = $0.002
    const cost = calculateCost('gemini-2.0-flash', {
      input: 10000,
      output: 5000,
    })
    expect(cost).toBeCloseTo(0.003, 6)
  })

  it('returns null for unknown models', () => {
    const cost = calculateCost('unknown-model', { input: 1000, output: 500 })
    expect(cost).toBeNull()
  })

  it('returns 0 for zero tokens', () => {
    const cost = calculateCost('gpt-4o', { input: 0, output: 0 })
    expect(cost).toBe(0)
  })

  it('handles input-only usage', () => {
    const cost = calculateCost('gpt-4o', { input: 1_000_000, output: 0 })
    expect(cost).toBeCloseTo(2.5, 2)
  })

  it('handles output-only usage', () => {
    const cost = calculateCost('gpt-4o', { input: 0, output: 1_000_000 })
    expect(cost).toBeCloseTo(10, 2)
  })
})

describe('calculateTotalCost', () => {
  it('sums costs across multiple token counts', () => {
    const cost = calculateTotalCost('gpt-4o', [
      { input: 1000, output: 500 },
      { input: 2000, output: 1000 },
      { input: 3000, output: 1500 },
    ])
    // Total: 6000 input at $2.50/1M + 3000 output at $10/1M
    // = $0.015 + $0.03 = $0.045
    expect(cost).toBeCloseTo(0.045, 6)
  })

  it('returns null for unknown models', () => {
    const cost = calculateTotalCost('unknown-model', [
      { input: 1000, output: 500 },
    ])
    expect(cost).toBeNull()
  })

  it('handles empty array', () => {
    const cost = calculateTotalCost('gpt-4o', [])
    expect(cost).toBe(0)
  })

  it('handles single token count', () => {
    const single = calculateCost('gpt-4o', { input: 1000, output: 500 })
    const total = calculateTotalCost('gpt-4o', [{ input: 1000, output: 500 }])
    expect(total).toEqual(single)
  })
})

describe('formatCost', () => {
  it('formats zero as $0.00', () => {
    expect(formatCost(0)).toBe('$0.00')
  })

  it('formats very small amounts as < $0.01', () => {
    expect(formatCost(0.001)).toBe('< $0.01')
    expect(formatCost(0.009)).toBe('< $0.01')
    expect(formatCost(0.0001)).toBe('< $0.01')
  })

  it('formats cents with two decimal places', () => {
    expect(formatCost(0.01)).toBe('$0.01')
    expect(formatCost(0.05)).toBe('$0.05')
    expect(formatCost(0.99)).toBe('$0.99')
  })

  it('formats dollars with two decimal places', () => {
    expect(formatCost(1)).toBe('$1.00')
    expect(formatCost(1.23)).toBe('$1.23')
    expect(formatCost(10.5)).toBe('$10.50')
    expect(formatCost(100)).toBe('$100.00')
  })
})

describe('formatTokenCount', () => {
  it('formats small numbers as-is', () => {
    expect(formatTokenCount(0)).toBe('0')
    expect(formatTokenCount(1)).toBe('1')
    expect(formatTokenCount(999)).toBe('999')
  })

  it('formats thousands with one decimal place', () => {
    expect(formatTokenCount(1000)).toBe('1.0K')
    expect(formatTokenCount(1500)).toBe('1.5K')
    expect(formatTokenCount(9999)).toBe('10.0K')
  })

  it('formats ten-thousands and above as rounded K', () => {
    expect(formatTokenCount(10000)).toBe('10K')
    expect(formatTokenCount(50000)).toBe('50K')
    expect(formatTokenCount(100000)).toBe('100K')
    expect(formatTokenCount(999999)).toBe('1000K')
  })

  it('formats millions with one decimal place', () => {
    expect(formatTokenCount(1_000_000)).toBe('1.0M')
    expect(formatTokenCount(2_500_000)).toBe('2.5M')
  })
})
