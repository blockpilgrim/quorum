/**
 * Model column -- displays messages for a single AI provider.
 *
 * Wrapped in React.memo for stream isolation. When three models stream
 * concurrently, tokens arriving for one provider should not re-render
 * the other columns.
 *
 * Integrates with useProviderChat for streaming and with MessageBubble
 * for rendering individual messages.
 */

import { memo, useEffect, useImperativeHandle, useRef } from 'react'
import type { ForwardedRef } from 'react'
import { forwardRef } from 'react'
import { AlertCircleIcon, LoaderIcon, RefreshCwIcon } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { MessageBubble } from '@/components/MessageBubble'
import { useProviderChat, getMessageText } from '@/hooks/useProviderChat'
import type { SendOptions } from '@/hooks/useProviderChat'
import type { Provider } from '@/lib/db/types'
import { getModelDisplayName, PROVIDER_COLORS } from '@/lib/models'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'

interface ModelColumnProps {
  provider: Provider
  label: string
}

/** Handle exposed to the parent for sending messages. */
export interface ModelColumnHandle {
  send: (text: string, options?: SendOptions) => Promise<boolean>
}

export const ModelColumn = memo(
  forwardRef(function ModelColumn(
    { provider, label }: ModelColumnProps,
    ref: ForwardedRef<ModelColumnHandle>,
  ) {
    const activeConversationId = useAppStore((s) => s.activeConversationId)
    const model = useAppStore((s) => s.selectedModels[provider])

    const {
      messages,
      status,
      error,
      send,
      stop,
      clearError,
      isLoading,
      crossFeedIds,
      tokenCountMap,
    } = useProviderChat({
      provider,
      conversationId: activeConversationId,
      model,
    })

    // Expose send to the parent via ref (isLoading syncs via Zustand store)
    useImperativeHandle(
      ref,
      () => ({
        send,
      }),
      [send],
    )

    // Auto-scroll to bottom when new messages arrive or status changes
    const scrollEndRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
      // scrollIntoView may not exist in test environments (jsdom)
      if (typeof scrollEndRef.current?.scrollIntoView === 'function') {
        scrollEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }, [messages.length, status])

    return (
      <section
        aria-label={`${label} conversation`}
        className="border-border flex min-h-0 flex-1 flex-col border-b last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
      >
        {/* Column header */}
        <div className="border-border flex items-center gap-2 border-b px-3 py-2">
          <div
            className={cn('h-2 w-2 rounded-full', PROVIDER_COLORS[provider])}
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <span className="text-foreground text-sm font-medium">{label}</span>
            <span className="text-muted-foreground text-[11px] leading-tight">
              {getModelDisplayName(model)}
            </span>
          </div>
          {isLoading && (
            <LoaderIcon
              className="text-muted-foreground h-3 w-3 animate-spin"
              aria-label={`${label} is streaming`}
            />
          )}
          {isLoading && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6"
              onClick={stop}
              aria-label={`Stop ${label} streaming`}
            >
              <span className="bg-foreground h-2.5 w-2.5 rounded-sm" aria-hidden="true" />
            </Button>
          )}
        </div>

        {/* Message area -- fade in on conversation switch */}
        <ScrollArea className="flex-1" aria-label={`${label} messages`}>
          <div
            key={activeConversationId ?? 'none'}
            className="conversation-fade-in flex flex-col gap-2 p-3"
            role="log"
            aria-live="polite"
            aria-label={`${label} message history`}
          >
            {messages.length === 0 && !error ? (
              <EmptyState
                text={
                  activeConversationId === null
                    ? `Start a conversation to see ${label} responses`
                    : `No messages from ${label} yet`
                }
              />
            ) : (
              <>
                {messages.map((msg, index) => {
                  const isLastAssistant =
                    msg.role === 'assistant' && index === messages.length - 1
                  const isCurrentlyStreaming =
                    isLastAssistant && status === 'streaming'

                  return (
                    <MessageBubble
                      key={msg.id}
                      role={msg.role as 'user' | 'assistant'}
                      content={getMessageText(msg)}
                      isStreaming={isCurrentlyStreaming}
                      isCrossFeed={crossFeedIds.has(msg.id)}
                      tokenCount={tokenCountMap.get(msg.id)}
                    />
                  )
                })}

                {/* Submitted state: waiting for first token */}
                {status === 'submitted' && (
                  <div
                    className="bg-card text-card-foreground self-start rounded-lg px-3 py-2 text-sm"
                    role="status"
                    aria-label={`Waiting for ${label} response`}
                  >
                    <LoaderIcon className="text-muted-foreground h-4 w-4 animate-spin" aria-hidden="true" />
                  </div>
                )}
              </>
            )}

            {/* Error display */}
            {error && (
              <div role="alert" className="bg-destructive/10 text-destructive self-start rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{error.message}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive mt-1 h-7 gap-1 px-2 text-xs"
                  onClick={clearError}
                >
                  <RefreshCwIcon className="h-3 w-3" />
                  Dismiss
                </Button>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={scrollEndRef} />
          </div>
        </ScrollArea>
      </section>
    )
  }),
)

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-muted-foreground flex flex-1 items-center justify-center py-12 text-center text-sm">
      {text}
    </div>
  )
}
