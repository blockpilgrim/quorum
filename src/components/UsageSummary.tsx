/**
 * Usage summary component showing token counts and estimated costs.
 *
 * Displayed in the TopBar as a Popover. Shows:
 * - Per-conversation totals by provider with cost estimates
 * - Overall totals across all conversations
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { db } from '@/lib/db'
import type { Message, Provider, TokenCount } from '@/lib/db/types'
import {
  PROVIDER_COLORS,
  PROVIDER_LABELS,
  getModelDisplayName,
} from '@/lib/models'
import {
  calculateTotalCost,
  formatCost,
  formatTokenCount,
} from '@/lib/pricing'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const PROVIDERS: Provider[] = ['claude', 'chatgpt', 'gemini']

/** Aggregated usage stats for a provider within a scope. */
interface ProviderUsage {
  provider: Provider
  inputTokens: number
  outputTokens: number
  messageCount: number
}

/** Aggregate token counts from messages by provider. */
function aggregateByProvider(messages: Message[]): ProviderUsage[] {
  const map = new Map<Provider, ProviderUsage>()
  for (const p of PROVIDERS) {
    map.set(p, { provider: p, inputTokens: 0, outputTokens: 0, messageCount: 0 })
  }

  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.tokenCount) continue
    const usage = map.get(msg.provider)
    if (usage) {
      usage.inputTokens += msg.tokenCount.input
      usage.outputTokens += msg.tokenCount.output
      usage.messageCount += 1
    }
  }

  return PROVIDERS.map((p) => map.get(p)!).filter((u) => u.messageCount > 0)
}

function ProviderUsageRow({
  usage,
  modelId,
}: {
  usage: ProviderUsage
  modelId: string
}) {
  const totalTokens = usage.inputTokens + usage.outputTokens
  const tokenCount: TokenCount = {
    input: usage.inputTokens,
    output: usage.outputTokens,
  }
  const cost = calculateTotalCost(modelId, [tokenCount])

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            PROVIDER_COLORS[usage.provider],
          )}
        />
        <div className="min-w-0">
          <span className="text-foreground text-xs font-medium">
            {PROVIDER_LABELS[usage.provider]}
          </span>
          <span className="text-muted-foreground ml-1 text-[10px]">
            {getModelDisplayName(modelId)}
          </span>
        </div>
      </div>
      <div className="text-right">
        <span className="text-foreground text-xs">
          {formatTokenCount(totalTokens)}
        </span>
        {cost !== null && (
          <span className="text-muted-foreground ml-1.5 text-[10px]">
            {formatCost(cost)}
          </span>
        )}
      </div>
    </div>
  )
}

function UsageSection({
  title,
  messages,
  selectedModels,
}: {
  title: string
  messages: Message[]
  selectedModels: Record<Provider, string>
}) {
  const providerUsages = aggregateByProvider(messages)

  if (providerUsages.length === 0) {
    return (
      <div>
        <h4 className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wider">
          {title}
        </h4>
        <p className="text-muted-foreground text-xs">No usage data yet</p>
      </div>
    )
  }

  // Calculate totals
  let totalInput = 0
  let totalOutput = 0
  let totalCost = 0
  for (const u of providerUsages) {
    totalInput += u.inputTokens
    totalOutput += u.outputTokens
    const cost = calculateTotalCost(selectedModels[u.provider], [
      { input: u.inputTokens, output: u.outputTokens },
    ])
    if (cost !== null) totalCost += cost
  }

  return (
    <div>
      <h4 className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wider">
        {title}
      </h4>
      {providerUsages.map((u) => (
        <ProviderUsageRow
          key={u.provider}
          usage={u}
          modelId={selectedModels[u.provider]}
        />
      ))}
      <div className="border-border mt-1 border-t pt-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px]">
            Total: {formatTokenCount(totalInput)} in /{' '}
            {formatTokenCount(totalOutput)} out
          </span>
          <span className="text-foreground text-xs font-medium">
            {formatCost(totalCost)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function UsageSummary() {
  const activeConversationId = useAppStore((s) => s.activeConversationId)
  const selectedModels = useAppStore((s) => s.selectedModels)

  // Query messages for the active conversation
  const conversationMessages = useLiveQuery(
    async () => {
      if (activeConversationId === null) return [] as Message[]
      return db.messages
        .where('conversationId')
        .equals(activeConversationId)
        .toArray()
    },
    [activeConversationId],
    [] as Message[],
  )

  // Query all messages across all conversations
  const allMessages = useLiveQuery(
    async () => {
      return db.messages.toArray()
    },
    [],
    [] as Message[],
  )

  // Check if there is any usage data at all
  const hasAnyUsage = allMessages.some(
    (m) => m.role === 'assistant' && m.tokenCount,
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Token usage"
        >
          <BarChart3Icon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72"
        align="end"
        sideOffset={4}
      >
        <div className="space-y-3">
          <h3 className="text-foreground text-sm font-semibold">
            Token Usage
          </h3>

          {!hasAnyUsage ? (
            <p className="text-muted-foreground text-xs">
              Token usage will appear here after you send messages.
            </p>
          ) : (
            <>
              {activeConversationId !== null && (
                <UsageSection
                  title="Current Conversation"
                  messages={conversationMessages}
                  selectedModels={selectedModels}
                />
              )}

              <UsageSection
                title="All Conversations"
                messages={allMessages}
                selectedModels={selectedModels}
              />
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
