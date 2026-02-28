/**
 * Tests for MessageBubble component.
 *
 * Covers:
 * - User vs assistant message rendering and styling
 * - Markdown rendering for assistant messages
 * - Copy-to-clipboard button (present for assistant, absent for user)
 * - Streaming cursor indicator
 * - Timestamp display
 * - formatTime edge cases
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MessageBubble } from '@/components/MessageBubble'

// Mock react-markdown since it relies on ESM internals that jsdom cannot handle.
// We verify the content is passed through rather than testing markdown parsing itself.
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown">{children}</div>
  ),
}))

vi.mock('remark-gfm', () => ({
  default: {},
}))

describe('MessageBubble', () => {
  describe('user messages', () => {
    it('renders user message content as plain text', () => {
      render(<MessageBubble role="user" content="Hello, world!" />)
      expect(screen.getByText('Hello, world!')).toBeInTheDocument()
    })

    it('renders with self-end alignment class for right-aligned bubble', () => {
      const { container } = render(<MessageBubble role="user" content="Test" />)
      const bubble = container.firstElementChild as HTMLElement
      expect(bubble.className).toContain('self-end')
    })

    it('renders user content in a <p> tag (not markdown)', () => {
      render(<MessageBubble role="user" content="Plain text message" />)
      // User messages are rendered in a <p>, not through the markdown component
      expect(screen.queryByTestId('markdown')).not.toBeInTheDocument()
      expect(screen.getByText('Plain text message').tagName).toBe('P')
    })

    it('does not show a copy button on user messages', () => {
      render(<MessageBubble role="user" content="My message" />)
      expect(
        screen.queryByRole('button', { name: /copy/i }),
      ).not.toBeInTheDocument()
    })
  })

  describe('assistant messages', () => {
    it('renders assistant message content through markdown', () => {
      render(<MessageBubble role="assistant" content="**Bold** text" />)
      expect(screen.getByTestId('markdown')).toBeInTheDocument()
      expect(screen.getByTestId('markdown')).toHaveTextContent('**Bold** text')
    })

    it('renders with self-start alignment class for left-aligned bubble', () => {
      const { container } = render(
        <MessageBubble role="assistant" content="Response" />,
      )
      const bubble = container.firstElementChild as HTMLElement
      expect(bubble.className).toContain('self-start')
    })

    it('shows a copy button on assistant messages', () => {
      render(<MessageBubble role="assistant" content="Copy me" />)
      expect(
        screen.getByRole('button', { name: 'Copy message' }),
      ).toBeInTheDocument()
    })

    it('copies content to clipboard when copy button is clicked', async () => {
      // Mock the clipboard API
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: { writeText },
      })

      render(<MessageBubble role="assistant" content="Content to copy" />)

      fireEvent.click(screen.getByRole('button', { name: 'Copy message' }))

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith('Content to copy')
      })

      // After copying, the aria-label should change to "Copied"
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Copied' }),
        ).toBeInTheDocument()
      })
    })
  })

  describe('streaming cursor', () => {
    it('does not show streaming cursor by default', () => {
      render(<MessageBubble role="assistant" content="Done response" />)
      expect(screen.queryByLabelText('Streaming')).not.toBeInTheDocument()
    })

    it('shows streaming cursor when isStreaming is true', () => {
      render(
        <MessageBubble
          role="assistant"
          content="Partial response..."
          isStreaming
        />,
      )
      expect(screen.getByLabelText('Streaming')).toBeInTheDocument()
    })

    it('does not show streaming cursor on user messages even if isStreaming is passed', () => {
      render(<MessageBubble role="user" content="User message" isStreaming />)
      // User messages are rendered as <p>, not the markdown+cursor path
      expect(screen.queryByLabelText('Streaming')).not.toBeInTheDocument()
    })
  })

  describe('timestamp', () => {
    it('displays formatted time when timestamp is provided', () => {
      // Use a known ISO date
      render(
        <MessageBubble
          role="user"
          content="Hello"
          timestamp="2026-02-28T14:30:00.000Z"
        />,
      )
      // There should be a <time> element with the ISO string as dateTime
      const timeEl = screen.getByRole('time')
      expect(timeEl).toBeInTheDocument()
      expect(timeEl).toHaveAttribute('datetime', '2026-02-28T14:30:00.000Z')
      // The displayed text should be a formatted time (locale-dependent, but non-empty)
      expect(timeEl.textContent).not.toBe('')
    })

    it('does not render time element when timestamp is not provided', () => {
      render(<MessageBubble role="user" content="Hello" />)
      expect(screen.queryByRole('time')).not.toBeInTheDocument()
    })

    it('handles invalid timestamp gracefully without crashing', () => {
      // formatTime wraps Date parsing in a try/catch. For an invalid date,
      // new Date('not-a-date') produces "Invalid Date" which toLocaleTimeString
      // may return as "Invalid Date" rather than throwing. Either way, the
      // component should render without errors.
      render(
        <MessageBubble
          role="assistant"
          content="Test"
          timestamp="not-a-date"
        />,
      )
      const timeEl = screen.getByRole('time')
      expect(timeEl).toBeInTheDocument()
      // The dateTime attribute should still be set to the raw value
      expect(timeEl).toHaveAttribute('datetime', 'not-a-date')
    })
  })

  describe('styling differences', () => {
    it('applies primary background to user messages', () => {
      const { container } = render(<MessageBubble role="user" content="User" />)
      const bubble = container.firstElementChild as HTMLElement
      expect(bubble.className).toContain('bg-primary')
    })

    it('applies card background to assistant messages', () => {
      const { container } = render(
        <MessageBubble role="assistant" content="Assistant" />,
      )
      const bubble = container.firstElementChild as HTMLElement
      expect(bubble.className).toContain('bg-card')
    })
  })
})
