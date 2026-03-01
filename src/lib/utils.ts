import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a conversation title from the user's first message.
 * Truncates at 60 characters on a word boundary, appending "..." if needed.
 */
export function generateTitle(text: string): string {
  const maxLength = 60
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= maxLength) return trimmed

  // Truncate at the last space before maxLength to avoid cutting words
  const truncated = trimmed.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > maxLength * 0.4) {
    return truncated.slice(0, lastSpace) + '...'
  }
  // If no good word boundary, just hard-truncate
  return truncated + '...'
}
