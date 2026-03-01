/**
 * Conversation sidebar -- lists past conversations and allows switching,
 * renaming, and deleting.
 *
 * On desktop (md+), renders as an inline sidebar panel.
 * On mobile (<md), renders as a Sheet overlay.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import {
  CheckIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { db, deleteConversation, updateConversation } from '@/lib/db'
import type { Conversation } from '@/lib/db/types'
import { useAppStore } from '@/lib/store'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ConversationSidebarProps {
  onNewConversation: () => void
}

export function ConversationSidebar({
  onNewConversation,
}: ConversationSidebarProps) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)

  const handleCloseSheet = useCallback(
    () => setSidebarOpen(false),
    [setSidebarOpen],
  )

  return (
    <>
      {/* Desktop: inline sidebar -- stays open on interaction */}
      {sidebarOpen && (
        <aside
          role="navigation"
          className="border-border bg-background hidden w-64 shrink-0 border-r md:block"
        >
          <SidebarContent onNewConversation={onNewConversation} />
        </aside>
      )}

      {/* Mobile: Sheet overlay -- closes on interaction */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-72 p-0 md:hidden"
          aria-describedby={undefined}
        >
          <SheetHeader className="border-border border-b px-4 py-3">
            <SheetTitle>Conversations</SheetTitle>
            <SheetDescription className="sr-only">
              Browse and select conversations
            </SheetDescription>
          </SheetHeader>
          <SidebarContent
            onNewConversation={onNewConversation}
            onAfterAction={handleCloseSheet}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

/**
 * Shared sidebar content used by both desktop and mobile variants.
 *
 * `onAfterAction` is called after selecting a conversation or creating a new one.
 * The mobile Sheet passes a close handler; the desktop variant omits it so the
 * sidebar stays open on interaction.
 */
function SidebarContent({
  onNewConversation,
  onAfterAction,
}: {
  onNewConversation: () => void
  onAfterAction?: () => void
}) {
  const activeConversationId = useAppStore((s) => s.activeConversationId)
  const setActiveConversationId = useAppStore((s) => s.setActiveConversationId)

  const conversations = useLiveQuery(
    () => db.conversations.orderBy('updatedAt').reverse().toArray(),
    [],
  )

  const handleSelect = useCallback(
    (id: number) => {
      setActiveConversationId(id)
      onAfterAction?.()
    },
    [setActiveConversationId, onAfterAction],
  )

  const handleNewConversation = useCallback(() => {
    onNewConversation()
    onAfterAction?.()
  }, [onNewConversation, onAfterAction])

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteConversation(id)
        // Read current active ID from store at execution time, not from closure.
        // The delete dialog may stay open while the user switches conversations,
        // so the closure's activeConversationId could be stale.
        if (useAppStore.getState().activeConversationId === id) {
          setActiveConversationId(null)
        }
      } catch (err) {
        console.error('[Sidebar] Failed to delete conversation:', err)
      }
    },
    [setActiveConversationId],
  )

  const handleRename = useCallback(async (id: number, newTitle: string) => {
    // Caller (confirmRename) already trims and validates non-empty
    try {
      await updateConversation(id, { title: newTitle })
    } catch (err) {
      console.error('[Sidebar] Failed to rename conversation:', err)
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleNewConversation}
        >
          <PlusIcon className="h-4 w-4" />
          New conversation
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {conversations === undefined ? (
            <ConversationListSkeleton />
          ) : conversations.length === 0 ? (
            <div className="text-muted-foreground px-2 py-4 text-center text-sm">
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={activeConversationId === conv.id}
                onSelect={handleSelect}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

/**
 * A single conversation item in the sidebar.
 *
 * Supports:
 * - Click to select
 * - Hover to reveal rename/delete action buttons
 * - Inline rename via an input field
 * - Delete with AlertDialog confirmation
 */
function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: {
  conversation: Conversation
  isActive: boolean
  onSelect: (id: number) => void
  onRename: (id: number, newTitle: string) => void
  onDelete: (id: number) => void
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const id = conversation.id!

  // Focus the input when entering rename mode
  useEffect(() => {
    if (isRenaming) {
      // Use requestAnimationFrame to ensure the input is rendered before focusing
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [isRenaming])

  const startRename = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setRenameValue(conversation.title)
      setIsRenaming(true)
    },
    [conversation.title],
  )

  const confirmRename = useCallback(() => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== conversation.title) {
      onRename(id, trimmed)
    }
    setIsRenaming(false)
  }, [renameValue, conversation.title, id, onRename])

  const cancelRename = useCallback(() => {
    setRenameValue(conversation.title)
    setIsRenaming(false)
  }, [conversation.title])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        confirmRename()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelRename()
      }
    },
    [confirmRename, cancelRename],
  )

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteDialogOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    onDelete(id)
    setDeleteDialogOpen(false)
  }, [id, onDelete])

  if (isRenaming) {
    return (
      <div className="flex items-center gap-1 rounded-md px-1 py-0.5">
        <Input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={confirmRename}
          className="h-7 text-sm"
          aria-label="Rename conversation"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onMouseDown={(e) => {
            // Prevent onBlur from firing before click
            e.preventDefault()
          }}
          onClick={confirmRename}
          aria-label="Confirm rename"
        >
          <CheckIcon className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onMouseDown={(e) => {
            // Prevent onBlur from firing before cancel click
            e.preventDefault()
          }}
          onClick={cancelRename}
          aria-label="Cancel rename"
        >
          <XIcon className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(id)
          }
        }}
        className={cn(
          'group flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isActive ? 'bg-accent text-accent-foreground' : 'text-foreground',
        )}
      >
        <MessageSquareIcon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{conversation.title}</span>

        {/* Action buttons -- visible on hover or focus-within for keyboard users */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={startRename}
            aria-label="Rename conversation"
          >
            <PencilIcon className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDeleteClick}
            aria-label="Delete conversation"
          >
            <TrashIcon className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{conversation.title}&rdquo;
              and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Skeleton placeholder shown while conversations are loading from Dexie. */
function ConversationListSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-2" role="status" aria-label="Loading conversations">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
      <span className="sr-only">Loading conversations...</span>
    </div>
  )
}
