/**
 * Tests for InputBar.
 * Uses fake-indexeddb for Dexie's useLiveQuery (settings API key check).
 *
 * Covers:
 * - Input enable/disable based on API keys and streaming state
 * - Send message behavior
 * - Cross-feed button enable/disable and click handling
 * - Textarea: Shift+Enter inserts newline, Enter sends message
 * - Textarea: renders as a textarea element (not input)
 */

import 'fake-indexeddb/auto'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputBar } from '@/components/InputBar'
import { updateSettings } from '@/lib/db'
import { clearAllTables, deleteDatabase } from '@/test/db-helpers'

const mockOnSend = vi.fn()
const mockOnCrossFeed = vi.fn()

beforeEach(async () => {
  await clearAllTables()
  vi.clearAllMocks()
})

afterAll(async () => {
  await deleteDatabase()
})

describe('InputBar', () => {
  it('is disabled when no API keys are configured', async () => {
    render(<InputBar onSend={mockOnSend} />)
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(
          'Configure your OpenRouter API key in settings to start...',
        ),
      ).toBeDisabled()
    })
  })

  it('is enabled when API keys are present', async () => {
    await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
    render(<InputBar onSend={mockOnSend} />)
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Ask all three models...'),
      ).not.toBeDisabled()
    })
  })

  it('clears input and calls onSend on submit', async () => {
    await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
    const user = userEvent.setup()
    render(<InputBar onSend={mockOnSend} />)

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Ask all three models...'),
      ).not.toBeDisabled()
    })

    const input = screen.getByPlaceholderText('Ask all three models...')
    await user.type(input, 'Hello{Enter}')
    expect(input).toHaveValue('')
    expect(mockOnSend).toHaveBeenCalledWith('Hello')
  })

  it('shows streaming placeholder when isStreaming is true', async () => {
    await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
    render(<InputBar onSend={mockOnSend} isStreaming />)
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Waiting for response...'),
      ).toBeDisabled()
    })
  })

  it('does not call onSend for empty input', async () => {
    await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
    const user = userEvent.setup()
    render(<InputBar onSend={mockOnSend} />)

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Ask all three models...'),
      ).not.toBeDisabled()
    })

    const input = screen.getByPlaceholderText('Ask all three models...')
    await user.type(input, '   {Enter}')
    expect(mockOnSend).not.toHaveBeenCalled()
  })

  describe('textarea behavior', () => {
    it('renders a textarea element', async () => {
      await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
      render(<InputBar onSend={mockOnSend} />)
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Ask all three models...'),
        ).not.toBeDisabled()
      })
      const textarea = screen.getByLabelText('Message input')
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('does not send on Shift+Enter (allows newline)', async () => {
      await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
      const user = userEvent.setup()
      render(<InputBar onSend={mockOnSend} />)

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Ask all three models...'),
        ).not.toBeDisabled()
      })

      const textarea = screen.getByLabelText('Message input')
      await user.type(textarea, 'line one{Shift>}{Enter}{/Shift}line two')

      // Should NOT have sent
      expect(mockOnSend).not.toHaveBeenCalled()
      // The textarea should contain a newline between the two lines
      expect(textarea).toHaveValue('line one\nline two')
    })

    it('sends on bare Enter (no Shift)', async () => {
      await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
      const user = userEvent.setup()
      render(<InputBar onSend={mockOnSend} />)

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Ask all three models...'),
        ).not.toBeDisabled()
      })

      const textarea = screen.getByLabelText('Message input')
      await user.type(textarea, 'Hello world{Enter}')

      expect(mockOnSend).toHaveBeenCalledWith('Hello world')
      expect(textarea).toHaveValue('')
    })

    it('sends multiline content on Enter after Shift+Enter', async () => {
      await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
      const user = userEvent.setup()
      render(<InputBar onSend={mockOnSend} />)

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Ask all three models...'),
        ).not.toBeDisabled()
      })

      const textarea = screen.getByLabelText('Message input')
      // Type first line, Shift+Enter for newline, type second line, Enter to send
      await user.type(textarea, 'first{Shift>}{Enter}{/Shift}second{Enter}')

      expect(mockOnSend).toHaveBeenCalledWith('first\nsecond')
      expect(textarea).toHaveValue('')
    })

    it('does not send when Enter is pressed on empty textarea', async () => {
      await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
      render(<InputBar onSend={mockOnSend} />)

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Ask all three models...'),
        ).not.toBeDisabled()
      })

      const textarea = screen.getByLabelText('Message input')
      fireEvent.keyDown(textarea, { key: 'Enter' })

      expect(mockOnSend).not.toHaveBeenCalled()
    })
  })

  describe('cross-feed button', () => {
    it('renders with the correct aria-label', async () => {
      await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
      render(
        <InputBar
          onSend={mockOnSend}
          onCrossFeed={mockOnCrossFeed}
          hasCrossFeedContent
        />,
      )
      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: 'Cross-feed responses between models',
          }),
        ).toBeInTheDocument()
      })
    })

    it('is disabled when hasCrossFeedContent is false', async () => {
      await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
      render(
        <InputBar
          onSend={mockOnSend}
          onCrossFeed={mockOnCrossFeed}
          hasCrossFeedContent={false}
        />,
      )
      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: 'Cross-feed responses between models',
          }),
        ).toBeDisabled()
      })
    })

    it('is disabled when hasCrossFeedContent is omitted (defaults to false)', async () => {
      await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
      render(<InputBar onSend={mockOnSend} onCrossFeed={mockOnCrossFeed} />)
      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: 'Cross-feed responses between models',
          }),
        ).toBeDisabled()
      })
    })

    it('is disabled when isStreaming is true even if hasCrossFeedContent is true', async () => {
      await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
      render(
        <InputBar
          onSend={mockOnSend}
          onCrossFeed={mockOnCrossFeed}
          isStreaming
          hasCrossFeedContent
        />,
      )
      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: 'Cross-feed responses between models',
          }),
        ).toBeDisabled()
      })
    })

    it('is enabled when hasCrossFeedContent is true and not streaming', async () => {
      await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
      render(
        <InputBar
          onSend={mockOnSend}
          onCrossFeed={mockOnCrossFeed}
          hasCrossFeedContent
        />,
      )
      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: 'Cross-feed responses between models',
          }),
        ).not.toBeDisabled()
      })
    })

    it('calls onCrossFeed when clicked', async () => {
      await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
      const user = userEvent.setup()
      render(
        <InputBar
          onSend={mockOnSend}
          onCrossFeed={mockOnCrossFeed}
          hasCrossFeedContent
        />,
      )
      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: 'Cross-feed responses between models',
          }),
        ).not.toBeDisabled()
      })

      await user.click(
        screen.getByRole('button', {
          name: 'Cross-feed responses between models',
        }),
      )
      expect(mockOnCrossFeed).toHaveBeenCalledTimes(1)
    })

    it('does not call onCrossFeed when button is disabled', async () => {
      await updateSettings({ apiKeys: { openrouter: 'sk-test-key-123' } })
      render(
        <InputBar
          onSend={mockOnSend}
          onCrossFeed={mockOnCrossFeed}
          hasCrossFeedContent={false}
        />,
      )
      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: 'Cross-feed responses between models',
          }),
        ).toBeDisabled()
      })

      // fireEvent bypasses pointer-event checks, but the button is disabled
      // so the browser/DOM will not fire the click handler
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Cross-feed responses between models',
        }),
      )
      expect(mockOnCrossFeed).not.toHaveBeenCalled()
    })
  })
})
