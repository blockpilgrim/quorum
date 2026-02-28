/**
 * Tests for InputBar.
 * Uses fake-indexeddb for Dexie's useLiveQuery (settings API key check).
 */

import 'fake-indexeddb/auto'

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputBar } from '@/components/InputBar'
import { db, updateSettings } from '@/lib/db'

const mockOnSend = vi.fn()

beforeEach(async () => {
  await db.conversations.clear()
  await db.messages.clear()
  await db.settings.clear()
  vi.clearAllMocks()
})

afterAll(async () => {
  await db.delete()
})

describe('InputBar', () => {
  it('is disabled when no API keys are configured', async () => {
    render(<InputBar onSend={mockOnSend} />)
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(
          'Configure API keys in settings to start...',
        ),
      ).toBeDisabled()
    })
  })

  it('is enabled when API keys are present', async () => {
    await updateSettings({ apiKeys: { claude: 'sk-test-key-123' } })
    render(<InputBar onSend={mockOnSend} />)
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Ask all three models...'),
      ).not.toBeDisabled()
    })
  })

  it('clears input and calls onSend on submit', async () => {
    await updateSettings({ apiKeys: { claude: 'sk-test-key-123' } })
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
    await updateSettings({ apiKeys: { claude: 'sk-test-key-123' } })
    render(<InputBar onSend={mockOnSend} isStreaming />)
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Waiting for response...'),
      ).toBeDisabled()
    })
  })

  it('does not call onSend for empty input', async () => {
    await updateSettings({ apiKeys: { claude: 'sk-test-key-123' } })
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
})
