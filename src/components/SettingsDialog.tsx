/**
 * Settings dialog for API key management and model selection.
 *
 * Three provider sections (Claude, ChatGPT, Gemini), each with:
 * - A masked API key input with show/hide toggle
 * - A model selector dropdown
 *
 * Changes save immediately to Dexie (persistence) and Zustand (runtime).
 * Dialog state is managed locally -- no need for global state.
 */

import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { EyeIcon, EyeOffIcon, SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { db, updateSettings } from '@/lib/db'
import type { Provider } from '@/lib/db/types'
import { MODEL_OPTIONS, PROVIDER_COLORS, PROVIDER_LABELS } from '@/lib/models'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** The three providers in display order. */
const PROVIDERS: Provider[] = ['claude', 'chatgpt', 'gemini']

export function SettingsDialog() {
  const [open, setOpen] = useState(false)

  // Reactive settings from Dexie
  const settings = useLiveQuery(() => db.settings.get(1), [])

  // Check if this is first run (no API keys configured)
  const hasAnyKey =
    settings != null &&
    (settings.apiKeys.claude !== '' ||
      settings.apiKeys.chatgpt !== '' ||
      settings.apiKeys.gemini !== '')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settings"
          className={cn('h-8 w-8', !hasAnyKey && 'text-chart-1 animate-pulse')}
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure API keys and model preferences for each provider.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 pt-2">
          {PROVIDERS.map((provider) => (
            <ProviderSection
              key={provider}
              provider={provider}
              apiKey={settings?.apiKeys[provider] ?? ''}
              selectedModel={settings?.selectedModels[provider] ?? ''}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ProviderSectionProps {
  provider: Provider
  apiKey: string
  selectedModel: string
}

function ProviderSection({
  provider,
  apiKey,
  selectedModel,
}: ProviderSectionProps) {
  const [showKey, setShowKey] = useState(false)
  const setSelectedModel = useAppStore((s) => s.setSelectedModel)
  const models = MODEL_OPTIONS[provider]

  // Local state for the API key input (instant visual feedback).
  // Debounce the Dexie write to avoid a transaction per keystroke.
  const [localKey, setLocalKey] = useState(apiKey)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from parent when Dexie value changes externally
  useEffect(() => {
    setLocalKey(apiKey)
  }, [apiKey])

  const handleApiKeyChange = (value: string) => {
    setLocalKey(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateSettings({ apiKeys: { [provider]: value } })
    }, 300)
  }

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleModelChange = async (modelId: string) => {
    // Update both Dexie (persistence) and Zustand (immediate runtime effect)
    await updateSettings({ selectedModels: { [provider]: modelId } })
    setSelectedModel(provider, modelId)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Provider header */}
      <div className="flex items-center gap-2">
        <div
          className={cn('h-2 w-2 rounded-full', PROVIDER_COLORS[provider])}
        />
        <span className="text-foreground text-sm font-medium">
          {PROVIDER_LABELS[provider]}
        </span>
      </div>

      {/* API key input */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${provider}-api-key`}
          className="text-muted-foreground text-xs"
        >
          API Key
        </label>
        <div className="relative">
          <Input
            id={`${provider}-api-key`}
            type={showKey ? 'text' : 'password'}
            value={localKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder={`Enter your ${PROVIDER_LABELS[provider]} API key`}
            className="pr-9"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 h-9 w-9"
            onClick={() => setShowKey(!showKey)}
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Model selector */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${provider}-model`}
          className="text-muted-foreground text-xs"
        >
          Model
        </label>
        <Select value={selectedModel} onValueChange={handleModelChange}>
          <SelectTrigger id={`${provider}-model`} className="w-full">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
