/**
 * Cross-feed message construction utilities.
 *
 * Pure functions for building the messages that get sent to each provider
 * during a cross-feed round. Each provider receives the other two models'
 * latest responses, clearly labeled.
 */

import type { Message, Provider } from '@/lib/db/types'
import { PROVIDER_LABELS } from '@/lib/models'

/** Latest assistant response text per provider. */
export interface CrossFeedInput {
  claude: string
  chatgpt: string
  gemini: string
}

/** Cross-feed messages to send to each provider. */
export interface CrossFeedMessages {
  claude: string
  chatgpt: string
  gemini: string
}

/**
 * Build the cross-feed message for a specific provider.
 * The message contains the other two providers' responses, clearly labeled.
 */
function buildMessageForProvider(
  targetProvider: Provider,
  input: CrossFeedInput,
): string {
  const otherProviders = (['claude', 'chatgpt', 'gemini'] as Provider[]).filter(
    (p) => p !== targetProvider,
  )

  const sections = otherProviders
    .map((p) => `**${PROVIDER_LABELS[p]}'s response:**\n${input[p]}`)
    .join('\n\n')

  return `Here are the other models' responses to the same prompt:\n\n${sections}\n\nPlease review these responses and share your perspective. Where do you agree or disagree? What would you add?`
}

/**
 * Build cross-feed messages for all three providers.
 * Each provider receives the other two providers' latest responses.
 */
export function buildCrossFeedMessages(
  input: CrossFeedInput,
): CrossFeedMessages {
  return {
    claude: buildMessageForProvider('claude', input),
    chatgpt: buildMessageForProvider('chatgpt', input),
    gemini: buildMessageForProvider('gemini', input),
  }
}

/**
 * Find the last assistant message in a list of messages.
 * Returns null if no assistant messages exist.
 */
export function findLastAssistant(messages: Message[]): Message | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return messages[i]
  }
  return null
}

/**
 * Compute the next cross-feed round number based on existing messages.
 * Scans all three providers' messages for the maximum crossFeedRound,
 * then returns max + 1. If no cross-feed messages exist yet, returns 1.
 */
export function getNextCrossFeedRound(...messageArrays: Message[][]): number {
  let maxRound = 0
  for (const messages of messageArrays) {
    for (const msg of messages) {
      if (msg.crossFeedRound !== null && msg.crossFeedRound > maxRound) {
        maxRound = msg.crossFeedRound
      }
    }
  }
  return maxRound + 1
}
