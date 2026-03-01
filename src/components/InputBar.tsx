/**
 * Shared input bar pinned to the bottom of the main content area.
 *
 * Accepts an `onSend` callback from the parent to dispatch user messages
 * to all provider columns. Disabled when no API keys are configured or
 * while any provider is streaming.
 */

import { ArrowLeftRightIcon, SendIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { db } from '@/lib/db'

interface InputBarProps {
  /** Called when the user submits a message. */
  onSend: (text: string) => void
  /** Called when the user triggers a cross-feed round. */
  onCrossFeed?: () => void
  /** Whether any provider is currently streaming (disables input). */
  isStreaming?: boolean
  /** Whether cross-feed is available (all providers have assistant responses). */
  hasCrossFeedContent?: boolean
}

export function InputBar({
  onSend,
  onCrossFeed,
  isStreaming = false,
  hasCrossFeedContent = false,
}: InputBarProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Check if any API keys are configured
  const settings = useLiveQuery(() => db.settings.get(1), [])
  const hasApiKeys =
    settings !== undefined &&
    settings !== null &&
    (settings.apiKeys.claude !== '' ||
      settings.apiKeys.chatgpt !== '' ||
      settings.apiKeys.gemini !== '')

  const isDisabled = !hasApiKeys || isStreaming

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isDisabled) return

    onSend(trimmed)
    setValue('')
    inputRef.current?.focus()
  }, [value, isDisabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div className="border-border bg-background shrink-0 border-t px-4 py-3">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !hasApiKeys
              ? 'Configure API keys in settings to start...'
              : isStreaming
                ? 'Waiting for response...'
                : 'Ask all three models...'
          }
          disabled={isDisabled}
          className="flex-1"
        />
        <Button
          onClick={onCrossFeed}
          disabled={!hasCrossFeedContent || isStreaming}
          size="icon"
          variant="outline"
          aria-label="Cross-feed responses between models"
          title="Cross-feed: share each model's response with the others"
        >
          <ArrowLeftRightIcon className="h-4 w-4" />
        </Button>
        <Button
          onClick={handleSend}
          disabled={isDisabled || value.trim() === ''}
          size="icon"
          aria-label="Send message"
        >
          <SendIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
