/**
 * Minimal tests for ConversationSidebar.
 * Uses fake-indexeddb for Dexie's useLiveQuery.
 */

import 'fake-indexeddb/auto'

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationSidebar } from '@/components/ConversationSidebar'
import { useAppStore } from '@/lib/store'
import { db, createConversation } from '@/lib/db'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

beforeEach(async () => {
  useAppStore.setState({ activeConversationId: null, sidebarOpen: true })
  await db.conversations.clear()
  await db.messages.clear()
  await db.settings.clear()
})

afterAll(async () => {
  await db.delete()
})

const modelConfig = {
  claude: 'claude-sonnet-4-20250514',
  chatgpt: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
}

describe('ConversationSidebar', () => {
  it('lists conversations from Dexie', async () => {
    await createConversation({ title: 'First Chat', modelConfig })
    await createConversation({ title: 'Second Chat', modelConfig })

    render(<ConversationSidebar onNewConversation={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByText('First Chat').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Second Chat').length).toBeGreaterThanOrEqual(
        1,
      )
    })
  })

  it('updates activeConversationId when a conversation is clicked', async () => {
    const convId = await createConversation({
      title: 'Clickable Chat',
      modelConfig,
    })

    const { container } = render(
      <ConversationSidebar onNewConversation={vi.fn()} />,
    )

    await waitFor(() => {
      expect(
        screen.getAllByText('Clickable Chat').length,
      ).toBeGreaterThanOrEqual(1)
    })

    const aside = container.querySelector('aside')!
    fireEvent.click(within(aside).getByText('Clickable Chat'))
    expect(useAppStore.getState().activeConversationId).toBe(convId)
  })

  it('calls onNewConversation when button is clicked', async () => {
    const onNew = vi.fn()
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(<ConversationSidebar onNewConversation={onNew} />)

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /new conversation/i }).length,
      ).toBeGreaterThanOrEqual(1)
    })

    const buttons = screen.getAllByRole('button', {
      name: /new conversation/i,
    })
    await user.click(buttons[0])
    expect(onNew).toHaveBeenCalledTimes(1)
  })
})
