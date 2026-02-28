/**
 * Smoke test for the App shell.
 *
 * Mocks useProviderChat to avoid AI SDK dependencies.
 * Tests that the main layout elements render correctly.
 */

import 'fake-indexeddb/auto'

import { render, screen } from '@testing-library/react'
import App from '@/App'
import { useAppStore } from '@/lib/store'
import { db } from '@/lib/db'

// Mock useProviderChat to avoid AI SDK / streaming dependencies
vi.mock('@/hooks/useProviderChat', () => ({
  useProviderChat: () => ({
    messages: [],
    status: 'ready',
    error: undefined,
    send: vi.fn().mockResolvedValue(true),
    stop: vi.fn(),
    clearError: vi.fn(),
    isLoading: false,
  }),
  getMessageText: () => '',
}))

beforeEach(async () => {
  useAppStore.setState({ sidebarOpen: false })
  await db.conversations.clear()
  await db.messages.clear()
  await db.settings.clear()
})

afterAll(async () => {
  await db.delete()
})

describe('App', () => {
  it('renders the main layout elements', () => {
    render(<App />)
    expect(screen.getByText('Cortex')).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('ChatGPT')).toBeInTheDocument()
    expect(screen.getByText('Gemini')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Send message' }),
    ).toBeInTheDocument()
  })
})
