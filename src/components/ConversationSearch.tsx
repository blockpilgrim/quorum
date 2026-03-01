/**
 * Quick conversation search dialog triggered by Cmd/Ctrl+K.
 *
 * Searches conversation titles in Dexie and allows quick switching.
 * Uses a controlled Dialog that mounts/unmounts the search content
 * to avoid running queries when closed.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MessageSquareIcon, SearchIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { db } from '@/lib/db'
import type { Conversation } from '@/lib/db/types'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface ConversationSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConversationSearch({
  open,
  onOpenChange,
}: ConversationSearchProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] translate-y-0 gap-0 p-0 sm:max-w-md"
      >
        <DialogTitle className="sr-only">Search conversations</DialogTitle>
        <DialogDescription className="sr-only">
          Type to filter conversations by title
        </DialogDescription>
        {open && <SearchContent onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SearchContent({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const setActiveConversationId = useAppStore((s) => s.setActiveConversationId)

  // Fetch all conversations, filter client-side for simplicity
  const conversations = useLiveQuery(
    () => db.conversations.orderBy('updatedAt').reverse().toArray(),
    [],
  )

  const filtered = (conversations ?? []).filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()),
  )

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const selectConversation = useCallback(
    (conv: Conversation) => {
      setActiveConversationId(conv.id!)
      onClose()
    },
    [setActiveConversationId, onClose],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          selectConversation(filtered[selectedIndex])
        }
      }
    },
    [filtered, selectedIndex, selectConversation],
  )

  return (
    <div onKeyDown={handleKeyDown}>
      {/* Search input */}
      <div className="border-border flex items-center gap-2 border-b px-3">
        <SearchIcon className="text-muted-foreground h-4 w-4 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations..."
          className="bg-transparent placeholder:text-muted-foreground h-10 flex-1 text-sm outline-none"
          aria-label="Search conversations"
        />
        <kbd className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
          ESC
        </kbd>
      </div>

      {/* Results list */}
      <div
        className="max-h-64 overflow-y-auto p-1"
        role="listbox"
        aria-label="Search results"
      >
        {filtered.length === 0 ? (
          <div className="text-muted-foreground px-3 py-6 text-center text-sm">
            {query ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          filtered.map((conv, index) => (
            <button
              key={conv.id}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => selectConversation(conv)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-accent/50',
              )}
            >
              <MessageSquareIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{conv.title}</span>
            </button>
          ))
        )}
      </div>

      {/* Footer with keyboard hint */}
      <div className="border-border text-muted-foreground flex items-center gap-3 border-t px-3 py-2 text-[11px]">
        <span>
          <kbd className="bg-muted rounded px-1 py-0.5 font-medium">
            &uarr;&darr;
          </kbd>{' '}
          navigate
        </span>
        <span>
          <kbd className="bg-muted rounded px-1 py-0.5 font-medium">
            &crarr;
          </kbd>{' '}
          select
        </span>
        <span>
          <kbd className="bg-muted rounded px-1 py-0.5 font-medium">esc</kbd>{' '}
          close
        </span>
      </div>
    </div>
  )
}
