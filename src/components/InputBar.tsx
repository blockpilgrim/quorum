/**
 * Shared input bar pinned to the bottom of the main content area.
 *
 * Accepts an `onSend` callback from the parent to dispatch user messages
 * to all provider columns. Disabled when no API keys are configured or
 * while any provider is streaming.
 *
 * Supports Shift+Enter for newline and Enter to send.
 */

import { ArrowLeftRightIcon, SendIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { cn } from '@/lib/utils'

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Check if any API keys are configured
  const settings = useLiveQuery(() => db.settings.get(1), [])
  const hasApiKeys =
    settings !== undefined &&
    settings !== null &&
    (settings.apiKeys.claude !== '' ||
      settings.apiKeys.chatgpt !== '' ||
      settings.apiKeys.gemini !== '')

  const isDisabled = !hasApiKeys || isStreaming

  // Auto-focus on mount and when streaming finishes (so user can immediately type)
  useEffect(() => {
    if (!isStreaming) {
      textareaRef.current?.focus()
    }
  }, [isStreaming])

  // Auto-resize textarea to fit content (up to max height)
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
  }, [value])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isDisabled) return

    onSend(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }, [value, isDisabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div className="border-border bg-background shrink-0 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
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
          rows={1}
          aria-label="Message input"
          className={cn(
            'border-input bg-transparent placeholder:text-muted-foreground focus-visible:ring-ring flex-1 resize-none rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
        <Button
          onClick={() => onCrossFeed?.()}
          disabled={!hasCrossFeedContent || isStreaming}
          size="icon"
          variant="outline"
          aria-label="Cross-feed responses between models"
          title="Cross-feed: share each model's response with the others"
          className="h-9 w-9 shrink-0"
        >
          <ArrowLeftRightIcon className="h-4 w-4" />
        </Button>
        <Button
          onClick={handleSend}
          disabled={isDisabled || value.trim() === ''}
          size="icon"
          aria-label="Send message"
          className="h-9 w-9 shrink-0"
        >
          <SendIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
