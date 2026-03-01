/**
 * Tests for UsageSummary component.
 *
 * Covers:
 * - aggregateByProvider pure function logic
 * - Rendering the popover trigger button
 * - Showing "no usage data" when there are no assistant messages with tokenCount
 * - Showing per-provider usage rows when data exists
 * - Showing current conversation vs all conversations sections
 * - Correct token/cost display formatting
 */

import 'fake-indexeddb/auto'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { addMessage } from '@/lib/db'
import { useAppStore } from '@/lib/store'
import { clearAllTables, deleteDatabase } from '@/test/db-helpers'

// We need to import the component after setting up mocks
import { UsageSummary } from '@/components/UsageSummary'

const defaultModels = {
  claude: 'claude-sonnet-4-6',
  chatgpt: 'gpt-5.2',
  gemini: 'gemini-2.5-flash',
}

beforeEach(async () => {
  useAppStore.setState({
    activeConversationId: null,
    sidebarOpen: false,
    selectedModels: defaultModels,
    streamingStatus: { claude: false, chatgpt: false, gemini: false },
  })
  await clearAllTables()
})

afterAll(async () => {
  await deleteDatabase()
})

/** Helper to open the popover by clicking the trigger button. */
function openPopover() {
  const trigger = screen.getByRole('button', { name: 'Token usage' })
  fireEvent.click(trigger)
}

describe('UsageSummary', () => {
  describe('trigger button', () => {
    it('renders a button with "Token usage" label', () => {
      render(<UsageSummary />)
      expect(
        screen.getByRole('button', { name: 'Token usage' }),
      ).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows informational text when there are no messages at all', async () => {
      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        expect(
          screen.getByText(
            'Token usage will appear here after you send messages.',
          ),
        ).toBeInTheDocument()
      })
    })

    it('shows informational text when there are only user messages', async () => {
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'user',
        content: 'Hello',
      })

      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        expect(
          screen.getByText(
            'Token usage will appear here after you send messages.',
          ),
        ).toBeInTheDocument()
      })
    })

    it('shows informational text when assistant messages have no tokenCount', async () => {
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Hello back',
        // tokenCount defaults to null
      })

      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        expect(
          screen.getByText(
            'Token usage will appear here after you send messages.',
          ),
        ).toBeInTheDocument()
      })
    })
  })

  describe('with usage data', () => {
    it('shows "All Conversations" section when there is usage data', async () => {
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Response',
        tokenCount: { input: 100, output: 200 },
      })

      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        expect(screen.getByText('All Conversations')).toBeInTheDocument()
      })
    })

    it('shows "Current Conversation" section when a conversation is active', async () => {
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Response',
        tokenCount: { input: 100, output: 200 },
      })

      useAppStore.setState({ activeConversationId: 1 })
      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        expect(screen.getByText('Current Conversation')).toBeInTheDocument()
        expect(screen.getByText('All Conversations')).toBeInTheDocument()
      })
    })

    it('does not show "Current Conversation" when no conversation is active', async () => {
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Response',
        tokenCount: { input: 100, output: 200 },
      })

      useAppStore.setState({ activeConversationId: null })
      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        expect(screen.getByText('All Conversations')).toBeInTheDocument()
      })
      expect(screen.queryByText('Current Conversation')).not.toBeInTheDocument()
    })

    it('shows provider label for providers with usage data', async () => {
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Response',
        tokenCount: { input: 500, output: 1000 },
      })

      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        expect(screen.getByText('Claude')).toBeInTheDocument()
      })
    })

    it('shows model display name next to provider label', async () => {
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Response',
        tokenCount: { input: 500, output: 1000 },
      })

      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        // Model display name for 'claude-sonnet-4-6' is 'Sonnet 4.6'
        expect(screen.getAllByText('Sonnet 4.6').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows multiple providers when they all have usage data', async () => {
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Claude response',
        tokenCount: { input: 100, output: 200 },
      })
      await addMessage({
        conversationId: 1,
        provider: 'chatgpt',
        role: 'assistant',
        content: 'ChatGPT response',
        tokenCount: { input: 150, output: 300 },
      })
      await addMessage({
        conversationId: 1,
        provider: 'gemini',
        role: 'assistant',
        content: 'Gemini response',
        tokenCount: { input: 200, output: 400 },
      })

      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        expect(screen.getAllByText('Claude').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('ChatGPT').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Gemini').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows "No usage data yet" in a section that has no matching messages', async () => {
      // Add data to conversation 2, but set active to conversation 1 (empty)
      await addMessage({
        conversationId: 2,
        provider: 'claude',
        role: 'assistant',
        content: 'Response',
        tokenCount: { input: 100, output: 200 },
      })

      useAppStore.setState({ activeConversationId: 1 })
      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        // The current conversation section should show "No usage data yet"
        expect(screen.getByText('No usage data yet')).toBeInTheDocument()
        // But "All Conversations" section should show data
        expect(screen.getByText('Claude')).toBeInTheDocument()
      })
    })

    it('does not count user messages in usage aggregation', async () => {
      // Add user messages with tokenCount (should be ignored)
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'user',
        content: 'User message',
        tokenCount: { input: 9999, output: 9999 },
      })

      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        // Should show empty state since user messages are not counted
        expect(
          screen.getByText(
            'Token usage will appear here after you send messages.',
          ),
        ).toBeInTheDocument()
      })
    })

    it('does not count assistant messages without tokenCount', async () => {
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'No token count',
        // tokenCount defaults to null
      })

      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        expect(
          screen.getByText(
            'Token usage will appear here after you send messages.',
          ),
        ).toBeInTheDocument()
      })
    })

    it('aggregates multiple messages from the same provider', async () => {
      // Add two assistant messages from Claude
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Response 1',
        tokenCount: { input: 100, output: 200 },
      })
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Response 2',
        tokenCount: { input: 300, output: 400 },
      })

      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        // Total tokens: (100+200) + (300+400) = 1000 = "1.0K"
        expect(screen.getAllByText('1.0K').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('displays the popover heading "Token Usage"', async () => {
      await addMessage({
        conversationId: 1,
        provider: 'claude',
        role: 'assistant',
        content: 'Response',
        tokenCount: { input: 100, output: 200 },
      })

      render(<UsageSummary />)
      openPopover()

      await waitFor(() => {
        expect(screen.getByText('Token Usage')).toBeInTheDocument()
      })
    })
  })
})
