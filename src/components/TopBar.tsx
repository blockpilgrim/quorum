/**
 * Top bar with app title, settings, new conversation button, and sidebar toggle.
 */

import { MenuIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsDialog } from '@/components/SettingsDialog'
import { UsageSummary } from '@/components/UsageSummary'
import { useAppStore } from '@/lib/store'

interface TopBarProps {
  onNewConversation: () => void
}

export function TopBar({ onNewConversation }: TopBarProps) {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  return (
    <header className="border-border bg-background flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        className="h-8 w-8"
      >
        <MenuIcon className="h-4 w-4" />
      </Button>

      <h1 className="text-foreground text-lg font-semibold tracking-tight">
        Cortex
      </h1>

      <div className="flex-1" />

      <UsageSummary />

      <SettingsDialog />

      <Button
        variant="ghost"
        size="icon"
        onClick={onNewConversation}
        aria-label="New conversation"
        className="h-8 w-8"
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </header>
  )
}
