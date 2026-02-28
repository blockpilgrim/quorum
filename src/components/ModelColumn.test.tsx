/**
 * Tests for ModelColumn.
 *
 * Mocks useProviderChat since the component now integrates with the AI SDK
 * for streaming. Tests focus on rendering behavior, not streaming logic.
 */

import 'fake-indexeddb/auto'

import { render, screen, waitFor } from '@testing-library/react'
import type { UIMessage } from 'ai'
import { ModelColumn } from '@/components/ModelColumn'
import { useAppStore } from '@/lib/store'
import { db } from '@/lib/db'

// Mock useProviderChat to avoid AI SDK dependencies in component tests
const mockSend = vi.fn().mockResolvedValue(true)
const mockStop = vi.fn()
const mockClearError = vi.fn()

let mockMessages: UIMessage[] = []
let mockStatus: 'ready' | 'submitted' | 'streaming' | 'error' = 'ready'
let mockError: Error | undefined = undefined

vi.mock('@/hooks/useProviderChat', () => ({
  useProviderChat: () => ({
    messages: mockMessages,
    status: mockStatus,
    error: mockError,
    send: mockSend,
    stop: mockStop,
    clearError: mockClearError,
    isLoading: mockStatus === 'submitted' || mockStatus === 'streaming',
  }),
  getMessageText: (msg: UIMessage) =>
    msg.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('') ?? '',
}))

beforeEach(async () => {
  useAppStore.setState({ activeConversationId: null, sidebarOpen: false })
  await db.conversations.clear()
  await db.messages.clear()
  await db.settings.clear()
  mockMessages = []
  mockStatus = 'ready'
  mockError = undefined
  vi.clearAllMocks()
})

afterAll(async () => {
  await db.delete()
})

describe('ModelColumn', () => {
  it('renders the provider label', () => {
    render(<ModelColumn provider="claude" label="Claude" />)
    expect(screen.getByText('Claude')).toBeInTheDocument()
  })

  it('renders messages from useProviderChat', async () => {
    mockMessages = [
      {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello Claude!' }],
      },
      {
        id: '2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hi there!' }],
      },
    ]

    useAppStore.setState({ activeConversationId: 1 })
    render(<ModelColumn provider="claude" label="Claude" />)

    await waitFor(() => {
      expect(screen.getByText('Hello Claude!')).toBeInTheDocument()
      expect(screen.getByText('Hi there!')).toBeInTheDocument()
    })
  })

  it('shows empty state when no conversation is active', () => {
    render(<ModelColumn provider="claude" label="Claude" />)
    expect(
      screen.getByText('Start a conversation to see Claude responses'),
    ).toBeInTheDocument()
  })

  it('shows a loading spinner when status is submitted', () => {
    mockMessages = [
      {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      },
    ]
    mockStatus = 'submitted'
    useAppStore.setState({ activeConversationId: 1 })
    render(<ModelColumn provider="claude" label="Claude" />)

    expect(screen.getByLabelText('Stop streaming')).toBeInTheDocument()
  })

  it('shows error display when there is an error', () => {
    mockError = new Error('API key invalid')
    useAppStore.setState({ activeConversationId: 1 })
    render(<ModelColumn provider="claude" label="Claude" />)

    expect(screen.getByText('API key invalid')).toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
  })
})
