/**
 * Export dropdown menu for downloading conversations.
 *
 * Supports exporting the current conversation or all conversations
 * in JSON or Markdown format. Export logic is lazy-loaded for bundle
 * performance.
 *
 * Placed in the TopBar alongside other action buttons.
 */

import { DownloadIcon, FileJsonIcon, FileTextIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  getConversation,
  getMessagesByConversation,
  listConversations,
} from '@/lib/db'
import type { Conversation, Message } from '@/lib/db/types'
import { useAppStore } from '@/lib/store'

type ExportFormat = 'json' | 'markdown'
type ExportScope = 'current' | 'all'

interface ExportAction {
  format: ExportFormat
  scope: ExportScope
}

/**
 * Lazy-load the export and download modules.
 *
 * These are only needed when the user actually clicks an export action,
 * so we split them out of the main bundle.
 */
async function performExport(
  action: ExportAction,
  conversations: Array<{ conversation: Conversation; messages: Message[] }>,
): Promise<void> {
  const [exportModule, downloadModule] = await Promise.all([
    import('@/lib/export'),
    import('@/lib/download'),
  ])

  const isSingle = action.scope === 'current' && conversations.length === 1
  const title = isSingle
    ? conversations[0].conversation.title
    : 'all-conversations'

  if (action.format === 'json') {
    const content = isSingle
      ? exportModule.exportConversationToJson(conversations[0])
      : exportModule.exportAllConversationsToJson(conversations)
    const filename = exportModule.buildExportFilename(title, 'json')
    downloadModule.downloadJson(content, filename)
  } else {
    const content = isSingle
      ? exportModule.exportConversationToMarkdown(conversations[0])
      : exportModule.exportAllConversationsToMarkdown(conversations)
    const filename = exportModule.buildExportFilename(title, 'md')
    downloadModule.downloadMarkdown(content, filename)
  }
}

export function ExportMenu() {
  const activeConversationId = useAppStore((s) => s.activeConversationId)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = useCallback(async (action: ExportAction) => {
    setExportError(null)

    if (action.scope === 'current') {
      const currentId = useAppStore.getState().activeConversationId
      if (currentId === null) return
    }

    setIsExporting(true)
    try {
      if (action.scope === 'current') {
        const currentId = useAppStore.getState().activeConversationId!

        const conversation = await getConversation(currentId)
        if (!conversation) return

        const messages = await getMessagesByConversation(currentId)
        await performExport(action, [{ conversation, messages }])
      } else {
        const allConversations = await listConversations()
        if (allConversations.length === 0) return

        const data = await Promise.all(
          allConversations.map(async (conversation) => {
            const messages = await getMessagesByConversation(conversation.id!)
            return { conversation, messages }
          }),
        )
        await performExport(action, data)
      }
    } catch (err) {
      console.error('[ExportMenu] Export failed:', err)
      setExportError('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }, [])

  const hasActiveConversation = activeConversationId !== null

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) setExportError(null)
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 sm:h-8 sm:w-8"
          aria-label="Export conversations"
          aria-busy={isExporting}
          disabled={isExporting}
        >
          <DownloadIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        {hasActiveConversation && (
          <>
            <DropdownMenuLabel>Current Conversation</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() =>
                  handleExport({ format: 'json', scope: 'current' })
                }
              >
                <FileJsonIcon />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleExport({ format: 'markdown', scope: 'current' })
                }
              >
                <FileTextIcon />
                Export as Markdown
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>All Conversations</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => handleExport({ format: 'json', scope: 'all' })}
          >
            <FileJsonIcon />
            Export all as JSON
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport({ format: 'markdown', scope: 'all' })}
          >
            <FileTextIcon />
            Export all as Markdown
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {exportError && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-sm text-destructive">
              {exportError}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
