/**
 * Token pricing table and cost calculation utilities.
 *
 * Maintains per-model pricing (price per 1M tokens) and provides pure
 * functions for cost estimation. Prices are in USD.
 */

import type { TokenCount } from '@/lib/db/types'
import { OPENROUTER_MODEL_MAP } from '@/lib/models'

// ---------------------------------------------------------------------------
// Pricing Table
// ---------------------------------------------------------------------------

/** Price per 1 million tokens for a model. */
export interface ModelPricing {
  /** Cost per 1M input (prompt) tokens in USD. */
  inputPer1M: number
  /** Cost per 1M output (completion) tokens in USD. */
  outputPer1M: number
}

/**
 * Base pricing per model ID. Prices are approximate and may change.
 * Last updated: 2026-03-01.
 *
 * OpenRouter model ID aliases are derived automatically from OPENROUTER_MODEL_MAP
 * so that price changes only need to be made in one place.
 */
const BASE_PRICING: Record<string, ModelPricing> = {
  // Claude
  'claude-sonnet-4-6': { inputPer1M: 3, outputPer1M: 15 },
  'claude-opus-4-6': { inputPer1M: 5, outputPer1M: 25 },

  // OpenAI
  'gpt-5.2': { inputPer1M: 1.75, outputPer1M: 14 },
  'gpt-5.3-codex': { inputPer1M: 1.75, outputPer1M: 14 },

  // Gemini
  'google/gemini-3.1-pro-preview': { inputPer1M: 1.25, outputPer1M: 10 },
}

/** Full pricing table with OpenRouter model ID aliases derived automatically. */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  ...BASE_PRICING,
  ...Object.fromEntries(
    Object.entries(OPENROUTER_MODEL_MAP)
      .filter(([directId, orId]) => directId !== orId && BASE_PRICING[directId])
      .map(([directId, orId]) => [orId, BASE_PRICING[directId]]),
  ),
}

// ---------------------------------------------------------------------------
// Cost Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the cost of a single message given its model and token counts.
 *
 * Returns the cost in USD, or null if the model has no known pricing.
 */
export function calculateCost(
  modelId: string,
  tokenCount: TokenCount,
): number | null {
  const pricing = MODEL_PRICING[modelId]
  if (!pricing) return null

  const inputCost = (tokenCount.input / 1_000_000) * pricing.inputPer1M
  const outputCost = (tokenCount.output / 1_000_000) * pricing.outputPer1M
  return inputCost + outputCost
}

/**
 * Calculate the total cost for a list of token counts with the same model.
 *
 * Returns the cost in USD, or null if the model has no known pricing.
 */
export function calculateTotalCost(
  modelId: string,
  tokenCounts: TokenCount[],
): number | null {
  const pricing = MODEL_PRICING[modelId]
  if (!pricing) return null

  let totalInput = 0
  let totalOutput = 0
  for (const tc of tokenCounts) {
    totalInput += tc.input
    totalOutput += tc.output
  }

  const inputCost = (totalInput / 1_000_000) * pricing.inputPer1M
  const outputCost = (totalOutput / 1_000_000) * pricing.outputPer1M
  return inputCost + outputCost
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a USD cost for display.
 *
 * - Costs < $0.01 are shown as "< $0.01"
 * - Costs >= $0.01 are shown with 2 decimal places (e.g., "$0.12")
 * - Costs >= $1 are shown with 2 decimal places (e.g., "$1.23")
 */
export function formatCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return '< $0.01'
  return `$${usd.toFixed(2)}`
}

/**
 * Format a token count for display (e.g., "1,234" or "1.2K").
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) return String(count)
  if (count < 10_000) return `${(count / 1000).toFixed(1)}K`
  if (count < 999_500) return `${Math.round(count / 1000)}K`
  return `${(count / 1_000_000).toFixed(1)}M`
}
