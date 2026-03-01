/**
 * Component tests for SettingsDialog.
 *
 * Uses fake-indexeddb for Dexie's useLiveQuery. Tests the dialog trigger,
 * API key inputs with show/hide toggle, model selectors, and the
 * first-run pulse animation on the gear icon.
 */

import 'fake-indexeddb/auto'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsDialog } from '@/components/SettingsDialog'
import { useAppStore } from '@/lib/store'
import { db, updateSettings } from '@/lib/db'
import { clearAllTables, deleteDatabase } from '@/test/db-helpers'

// Radix Select calls scrollIntoView on items, which jsdom doesn't implement
Element.prototype.scrollIntoView = vi.fn()

beforeEach(async () => {
  useAppStore.setState({
    activeConversationId: null,
    sidebarOpen: false,
    selectedModels: {
      claude: 'claude-sonnet-4-6',
      chatgpt: 'gpt-5.2',
      gemini: 'gemini-2.5-flash',
    },
    streamingStatus: { claude: false, chatgpt: false, gemini: false },
  })
  await clearAllTables()
})

afterAll(async () => {
  await deleteDatabase()
})

describe('SettingsDialog', () => {
  describe('trigger button', () => {
    it('renders a settings button with gear icon', () => {
      render(<SettingsDialog />)
      expect(
        screen.getByRole('button', { name: 'Settings' }),
      ).toBeInTheDocument()
    })

    it('pulses when no API keys are configured', async () => {
      render(<SettingsDialog />)

      // Wait for useLiveQuery to resolve (settings get auto-initialized with empty keys)
      await waitFor(() => {
        const button = screen.getByRole('button', { name: 'Settings' })
        expect(button.className).toContain('animate-pulse')
      })
    })

    it('does not pulse when at least one API key is configured', async () => {
      await updateSettings({ apiKeys: { claude: 'sk-ant-test-key' } })

      render(<SettingsDialog />)

      await waitFor(() => {
        const button = screen.getByRole('button', { name: 'Settings' })
        expect(button.className).not.toContain('animate-pulse')
      })
    })
  })

  describe('dialog content', () => {
    async function openDialog() {
      const user = userEvent.setup()
      render(<SettingsDialog />)
      await user.click(screen.getByRole('button', { name: 'Settings' }))

      // Wait for dialog to open (Radix renders in a portal)
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })
      return user
    }

    it('shows dialog title and description when opened', async () => {
      await openDialog()

      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Configure API keys and model preferences for each provider.',
        ),
      ).toBeInTheDocument()
    })

    it('shows all three provider sections', async () => {
      await openDialog()

      expect(screen.getByText('Claude')).toBeInTheDocument()
      expect(screen.getByText('ChatGPT')).toBeInTheDocument()
      expect(screen.getByText('Gemini')).toBeInTheDocument()
    })

    it('shows API Key labels and inputs for each provider', async () => {
      await openDialog()

      // Each provider should have an API key input
      const apiKeyInputs = screen.getAllByLabelText('API Key')
      expect(apiKeyInputs.length).toBe(3)
    })

    it('shows Model labels for each provider', async () => {
      await openDialog()

      const modelLabels = screen.getAllByText('Model')
      expect(modelLabels.length).toBe(3)
    })

    it('API key inputs default to password type (masked)', async () => {
      await openDialog()

      const claudeInput = screen.getByLabelText('API Key', {
        selector: '#claude-api-key',
      })
      expect(claudeInput).toHaveAttribute('type', 'password')
    })

    it('shows provider-specific placeholder text for API key inputs', async () => {
      await openDialog()

      const claudeInput = screen.getByPlaceholderText(
        'Enter your Claude API key',
      )
      const chatgptInput = screen.getByPlaceholderText(
        'Enter your ChatGPT API key',
      )
      const geminiInput = screen.getByPlaceholderText(
        'Enter your OpenRouter API key',
      )

      expect(claudeInput).toBeInTheDocument()
      expect(chatgptInput).toBeInTheDocument()
      expect(geminiInput).toBeInTheDocument()
    })

    it('shows OpenRouter (not Gemini) in the Gemini API key placeholder', async () => {
      await openDialog()

      // The Gemini provider should reference OpenRouter since Gemini is
      // routed through OpenRouter's API
      const geminiInput = screen.getByLabelText('API Key', {
        selector: '#gemini-api-key',
      })
      expect(geminiInput).toHaveAttribute(
        'placeholder',
        'Enter your OpenRouter API key',
      )
    })
  })

  describe('API key show/hide toggle', () => {
    it('toggles API key visibility from password to text', async () => {
      const user = userEvent.setup()
      render(<SettingsDialog />)
      await user.click(screen.getByRole('button', { name: 'Settings' }))

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })

      const claudeInput = screen.getByLabelText('API Key', {
        selector: '#claude-api-key',
      })
      expect(claudeInput).toHaveAttribute('type', 'password')

      // Click "Show API key" button (first one is for Claude)
      const showButtons = screen.getAllByRole('button', {
        name: 'Show API key',
      })
      await user.click(showButtons[0])

      // Input should now be text type
      expect(claudeInput).toHaveAttribute('type', 'text')
    })

    it('toggles API key visibility from text back to password', async () => {
      const user = userEvent.setup()
      render(<SettingsDialog />)
      await user.click(screen.getByRole('button', { name: 'Settings' }))

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })

      // Show the key
      const showButtons = screen.getAllByRole('button', {
        name: 'Show API key',
      })
      await user.click(showButtons[0])

      // Now hide it again
      const hideButton = screen.getByRole('button', { name: 'Hide API key' })
      await user.click(hideButton)

      const claudeInput = screen.getByLabelText('API Key', {
        selector: '#claude-api-key',
      })
      expect(claudeInput).toHaveAttribute('type', 'password')
    })
  })

  describe('API key persistence', () => {
    it('saves API key to Dexie when changed', async () => {
      const user = userEvent.setup()
      render(<SettingsDialog />)
      await user.click(screen.getByRole('button', { name: 'Settings' }))

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })

      const claudeInput = screen.getByLabelText('API Key', {
        selector: '#claude-api-key',
      })

      // Use fireEvent.change to set the value directly (avoids userEvent
      // interpreting hyphens as keyboard shortcut modifiers)
      fireEvent.change(claudeInput, {
        target: { value: 'sk-ant-test-123' },
      })

      // Verify it persisted to Dexie
      await waitFor(async () => {
        const settings = await db.settings.get(1)
        expect(settings?.apiKeys.claude).toBe('sk-ant-test-123')
      })
    })

    it('preserves other provider keys when updating one', async () => {
      // Pre-configure a ChatGPT key
      await updateSettings({ apiKeys: { chatgpt: 'sk-openai-existing' } })

      const user = userEvent.setup()
      render(<SettingsDialog />)
      await user.click(screen.getByRole('button', { name: 'Settings' }))

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })

      const claudeInput = screen.getByLabelText('API Key', {
        selector: '#claude-api-key',
      })
      fireEvent.change(claudeInput, {
        target: { value: 'sk-ant-new' },
      })

      // The ChatGPT key should still be there
      await waitFor(async () => {
        const settings = await db.settings.get(1)
        expect(settings?.apiKeys.chatgpt).toBe('sk-openai-existing')
        expect(settings?.apiKeys.claude).toBe('sk-ant-new')
      })
    })
  })

  describe('model selection', () => {
    it('updates Zustand store when model is changed', async () => {
      // Initialize settings so useLiveQuery has data
      await updateSettings({
        selectedModels: { claude: 'claude-sonnet-4-6' },
      })

      const user = userEvent.setup()
      render(<SettingsDialog />)
      await user.click(screen.getByRole('button', { name: 'Settings' }))

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })

      // Find the Claude model select trigger by its id
      const claudeModelTrigger = document.getElementById(
        'claude-model',
      ) as HTMLElement
      expect(claudeModelTrigger).toBeTruthy()

      // Use fireEvent because Radix Select has pointer-events issues in jsdom
      fireEvent.click(claudeModelTrigger)

      // Wait for dropdown to appear and select a different model
      await waitFor(() => {
        expect(screen.getByText('Opus 4.6')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Opus 4.6'))

      // Verify Zustand store was updated
      await waitFor(() => {
        const { selectedModels } = useAppStore.getState()
        expect(selectedModels.claude).toBe('claude-opus-4-6')
      })
    })

    it('persists model change to Dexie', async () => {
      await updateSettings({
        selectedModels: { claude: 'claude-sonnet-4-6' },
      })

      const user = userEvent.setup()
      render(<SettingsDialog />)
      await user.click(screen.getByRole('button', { name: 'Settings' }))

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })

      const claudeModelTrigger = document.getElementById(
        'claude-model',
      ) as HTMLElement
      expect(claudeModelTrigger).toBeTruthy()

      fireEvent.click(claudeModelTrigger)

      await waitFor(() => {
        expect(screen.getByText('Opus 4.6')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Opus 4.6'))

      // Verify Dexie was updated
      await waitFor(async () => {
        const settings = await db.settings.get(1)
        expect(settings?.selectedModels.claude).toBe('claude-opus-4-6')
      })
    })
  })

  describe('first-run detection', () => {
    it('shows pulse when all API keys are empty strings', async () => {
      // Initialize settings with empty keys (simulating first run)
      await updateSettings({
        apiKeys: { claude: '', chatgpt: '', gemini: '' },
      })

      render(<SettingsDialog />)

      await waitFor(() => {
        const button = screen.getByRole('button', { name: 'Settings' })
        expect(button.className).toContain('animate-pulse')
      })
    })

    it('stops pulsing when any single key is set', async () => {
      // Start with no keys
      render(<SettingsDialog />)

      await waitFor(() => {
        const button = screen.getByRole('button', { name: 'Settings' })
        expect(button.className).toContain('animate-pulse')
      })

      // Add a key
      await updateSettings({ apiKeys: { gemini: 'AIza-test-key' } })

      // useLiveQuery should re-render and remove the pulse
      await waitFor(() => {
        const button = screen.getByRole('button', { name: 'Settings' })
        expect(button.className).not.toContain('animate-pulse')
      })
    })
  })
})
