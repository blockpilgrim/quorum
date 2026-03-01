/**
 * Tests for ConversationSearch.
 *
 * Mocks `useLiveQuery` from dexie-react-hooks to avoid real Dexie queries.
 * Tests cover:
 * - Rendering the dialog with search input when open
 * - Case-insensitive filtering of conversations by title
 * - Empty state messages (no conversations vs. no matches)
 * - Keyboard navigation (ArrowDown, ArrowUp, Enter)
 * - Clicking a conversation to select it
 * - Clears search query when dialog re-opens (remount)
 * - Sets activeConversationId in Zustand and calls onOpenChange(false) on select
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationSearch } from '@/components/ConversationSearch'
import { useAppStore } from '@/lib/store'
import type { Conversation } from '@/lib/db/types'

// Mock useLiveQuery to return controlled conversation data
const mockConversations: Conversation[] = []
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => unknown) => {
    // Ignore the actual fn -- return the mock data directly
    void fn
    return mockConversations
  },
}))

// Radix Dialog uses ResizeObserver
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

const mockOnOpenChange = vi.fn()

function setConversations(convs: Conversation[]) {
  mockConversations.length = 0
  mockConversations.push(...convs)
}

function makeConversation(
  id: number,
  title: string,
  updatedAt?: string,
): Conversation {
  const now = updatedAt ?? new Date().toISOString()
  return {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    modelConfig: {
      claude: 'claude-sonnet-4-6',
      chatgpt: 'gpt-5.2',
      gemini: 'gemini-3-flash-preview',
    },
  }
}

/** Get the search input by its placeholder text (unique in the DOM). */
function getSearchInput() {
  return screen.getByPlaceholderText('Search conversations...')
}

beforeEach(() => {
  vi.clearAllMocks()
  setConversations([])
  useAppStore.setState({
    activeConversationId: null,
    sidebarOpen: false,
    streamingStatus: { claude: false, chatgpt: false, gemini: false },
  })
})

function renderSearch(open = true) {
  return render(
    <ConversationSearch open={open} onOpenChange={mockOnOpenChange} />,
  )
}

describe('ConversationSearch', () => {
  describe('rendering', () => {
    it('renders the search input when open', () => {
      renderSearch(true)
      expect(getSearchInput()).toBeInTheDocument()
    })

    it('does not render search content when closed', () => {
      renderSearch(false)
      expect(
        screen.queryByPlaceholderText('Search conversations...'),
      ).not.toBeInTheDocument()
    })

    it('renders an accessible dialog title', () => {
      renderSearch(true)
      // The dialog title is rendered as sr-only h2
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
        'Search conversations',
      )
    })
  })

  describe('empty states', () => {
    it('shows "No conversations yet" when there are no conversations and no query', () => {
      setConversations([])
      renderSearch(true)
      expect(screen.getByText('No conversations yet')).toBeInTheDocument()
    })

    it('shows "No conversations found" when query matches nothing', async () => {
      setConversations([makeConversation(1, 'Hello World')])
      renderSearch(true)

      const input = getSearchInput()
      await userEvent.setup().type(input, 'zzz-no-match')

      expect(screen.getByText('No conversations found')).toBeInTheDocument()
    })
  })

  describe('filtering', () => {
    it('shows all conversations when query is empty', () => {
      setConversations([
        makeConversation(1, 'Alpha'),
        makeConversation(2, 'Beta'),
        makeConversation(3, 'Gamma'),
      ])
      renderSearch(true)

      const listbox = screen.getByRole('listbox')
      const options = within(listbox).getAllByRole('option')
      expect(options).toHaveLength(3)
    })

    it('filters conversations by title (case-insensitive)', async () => {
      setConversations([
        makeConversation(1, 'React Hooks Discussion'),
        makeConversation(2, 'Python Scripts'),
        makeConversation(3, 'REACT Performance Tips'),
      ])
      renderSearch(true)

      const input = getSearchInput()
      await userEvent.setup().type(input, 'react')

      const listbox = screen.getByRole('listbox')
      const options = within(listbox).getAllByRole('option')
      expect(options).toHaveLength(2)
      expect(options[0]).toHaveTextContent('React Hooks Discussion')
      expect(options[1]).toHaveTextContent('REACT Performance Tips')
    })

    it('filters with partial match', async () => {
      setConversations([
        makeConversation(1, 'Building a REST API'),
        makeConversation(2, 'Testing strategies'),
        makeConversation(3, 'REST best practices'),
      ])
      renderSearch(true)

      const input = getSearchInput()
      await userEvent.setup().type(input, 'REST')

      const listbox = screen.getByRole('listbox')
      const options = within(listbox).getAllByRole('option')
      expect(options).toHaveLength(2)
    })
  })

  describe('keyboard navigation', () => {
    it('first item is selected by default', () => {
      setConversations([
        makeConversation(1, 'First'),
        makeConversation(2, 'Second'),
        makeConversation(3, 'Third'),
      ])
      renderSearch(true)

      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')
      expect(options[1]).toHaveAttribute('aria-selected', 'false')
    })

    it('ArrowDown moves selection down', () => {
      setConversations([
        makeConversation(1, 'First'),
        makeConversation(2, 'Second'),
        makeConversation(3, 'Third'),
      ])
      renderSearch(true)

      // The onKeyDown handler is on the wrapping div, events bubble from input
      const input = getSearchInput()
      fireEvent.keyDown(input, { key: 'ArrowDown' })

      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'false')
      expect(options[1]).toHaveAttribute('aria-selected', 'true')
    })

    it('ArrowDown does not go past the last item', () => {
      setConversations([
        makeConversation(1, 'First'),
        makeConversation(2, 'Second'),
      ])
      renderSearch(true)

      const input = getSearchInput()
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowDown' }) // extra press

      const options = screen.getAllByRole('option')
      expect(options[1]).toHaveAttribute('aria-selected', 'true')
    })

    it('ArrowUp moves selection up', () => {
      setConversations([
        makeConversation(1, 'First'),
        makeConversation(2, 'Second'),
        makeConversation(3, 'Third'),
      ])
      renderSearch(true)

      const input = getSearchInput()
      // Move down twice then up once
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowUp' })

      const options = screen.getAllByRole('option')
      expect(options[1]).toHaveAttribute('aria-selected', 'true')
    })

    it('ArrowUp does not go before the first item', () => {
      setConversations([
        makeConversation(1, 'First'),
        makeConversation(2, 'Second'),
      ])
      renderSearch(true)

      const input = getSearchInput()
      fireEvent.keyDown(input, { key: 'ArrowUp' }) // already at 0

      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')
    })

    it('Enter selects the highlighted conversation and closes dialog', () => {
      setConversations([
        makeConversation(1, 'First'),
        makeConversation(2, 'Second'),
        makeConversation(3, 'Third'),
      ])
      renderSearch(true)

      const input = getSearchInput()
      fireEvent.keyDown(input, { key: 'ArrowDown' }) // select Second
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(useAppStore.getState().activeConversationId).toBe(2)
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })

    it('Enter does nothing when there are no results', async () => {
      setConversations([makeConversation(1, 'Hello')])
      renderSearch(true)

      const input = getSearchInput()
      await userEvent.setup().type(input, 'zzz')

      fireEvent.keyDown(input, { key: 'Enter' })

      expect(useAppStore.getState().activeConversationId).toBeNull()
    })

    it('resets selection index when query changes', async () => {
      setConversations([
        makeConversation(1, 'Alpha project'),
        makeConversation(2, 'Beta project'),
        makeConversation(3, 'Alpha testing'),
      ])
      renderSearch(true)

      const input = getSearchInput()
      // Move down to second item
      fireEvent.keyDown(input, { key: 'ArrowDown' })

      // Type to filter -- selection should reset to 0
      await userEvent.setup().type(input, 'Alpha')

      // Now Enter should select the first filtered result
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(useAppStore.getState().activeConversationId).toBe(1)
    })
  })

  describe('click selection', () => {
    it('selects a conversation when clicked', () => {
      setConversations([
        makeConversation(1, 'Click me'),
        makeConversation(2, 'Not me'),
      ])
      renderSearch(true)

      const option = screen.getByText('Click me')
      fireEvent.click(option.closest('button')!)

      expect(useAppStore.getState().activeConversationId).toBe(1)
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('remount behavior', () => {
    it('starts with an empty search query on each mount', () => {
      setConversations([makeConversation(1, 'Test')])

      const { unmount } = renderSearch(true)

      // The input should start empty
      expect(getSearchInput()).toHaveValue('')

      unmount()

      // Re-render -- should have empty query again (fresh mount via conditional rendering)
      renderSearch(true)
      expect(getSearchInput()).toHaveValue('')
    })
  })
})
