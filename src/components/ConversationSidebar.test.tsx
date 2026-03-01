/**
 * Tests for ConversationSidebar.
 * Uses fake-indexeddb for Dexie's useLiveQuery.
 *
 * Covers:
 * - Listing conversations from Dexie
 * - Selecting a conversation updates Zustand store
 * - New conversation button callback
 * - Rename: enter edit mode, confirm (Enter/blur), cancel (Escape), reject empty
 * - Delete: open confirmation dialog, confirm delete, cancel dialog,
 *   clear activeConversationId if deleted conversation was active
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
import { clearAllTables, deleteDatabase } from '@/test/db-helpers'

const modelConfig = {
  claude: 'claude-sonnet-4-6',
  chatgpt: 'gpt-5.2',
  gemini: 'gemini-2.5-flash',
}

beforeEach(async () => {
  useAppStore.setState({
    activeConversationId: null,
    sidebarOpen: true,
    streamingStatus: { claude: false, chatgpt: false, gemini: false },
  })
  await clearAllTables()
})

afterAll(async () => {
  await deleteDatabase()
})

/**
 * Helper: render the sidebar and return the desktop aside element
 * scoped with `within()` for querying. Uses `{ hidden: true }` because
 * the desktop aside has `class="hidden md:block"` which is display:none in jsdom.
 */
function renderSidebar(onNew = vi.fn()) {
  const result = render(<ConversationSidebar onNewConversation={onNew} />)
  return { ...result, onNew }
}

/**
 * Helper: get the desktop aside element for scoped queries.
 */
function getDesktopAside(container: HTMLElement) {
  const aside = container.querySelector('aside')
  if (!aside) throw new Error('Desktop aside not found')
  return aside
}

describe('ConversationSidebar', () => {
  describe('listing conversations', () => {
    it('lists conversations from Dexie', async () => {
      await createConversation({ title: 'First Chat', modelConfig })
      await createConversation({ title: 'Second Chat', modelConfig })

      renderSidebar()

      await waitFor(() => {
        expect(screen.getAllByText('First Chat').length).toBeGreaterThanOrEqual(
          1,
        )
        expect(
          screen.getAllByText('Second Chat').length,
        ).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows empty state when no conversations exist', async () => {
      renderSidebar()

      await waitFor(() => {
        expect(
          screen.getAllByText('No conversations yet').length,
        ).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('selecting a conversation', () => {
    it('updates activeConversationId when a conversation is clicked', async () => {
      const convId = await createConversation({
        title: 'Clickable Chat',
        modelConfig,
      })

      const { container } = renderSidebar()

      await waitFor(() => {
        expect(
          screen.getAllByText('Clickable Chat').length,
        ).toBeGreaterThanOrEqual(1)
      })

      const aside = getDesktopAside(container)
      fireEvent.click(within(aside).getByText('Clickable Chat'))
      expect(useAppStore.getState().activeConversationId).toBe(convId)
    })
  })

  describe('new conversation button', () => {
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

  describe('rename', () => {
    it('enters edit mode when the rename button is clicked', async () => {
      await createConversation({ title: 'My Chat', modelConfig })
      const { container } = renderSidebar()

      await waitFor(() => {
        expect(screen.getAllByText('My Chat').length).toBeGreaterThanOrEqual(1)
      })

      const aside = getDesktopAside(container)
      // Click the rename button (pencil icon) -- use fireEvent to bypass pointer-events
      const renameBtn = within(aside).getByRole('button', {
        name: 'Rename conversation',
        hidden: true,
      })
      fireEvent.click(renameBtn)

      // Should show the rename input
      await waitFor(() => {
        expect(
          within(aside).getByLabelText('Rename conversation'),
        ).toBeInTheDocument()
      })
    })

    it('pre-populates the rename input with the current title', async () => {
      await createConversation({ title: 'Original Title', modelConfig })
      const { container } = renderSidebar()

      await waitFor(() => {
        expect(
          screen.getAllByText('Original Title').length,
        ).toBeGreaterThanOrEqual(1)
      })

      const aside = getDesktopAside(container)
      const renameBtn = within(aside).getByRole('button', {
        name: 'Rename conversation',
        hidden: true,
      })
      fireEvent.click(renameBtn)

      await waitFor(() => {
        const input = within(aside).getByLabelText('Rename conversation')
        expect(input).toHaveValue('Original Title')
      })
    })

    it('confirms rename on Enter and updates the conversation in Dexie', async () => {
      const convId = await createConversation({
        title: 'Old Name',
        modelConfig,
      })
      const { container } = renderSidebar()

      await waitFor(() => {
        expect(screen.getAllByText('Old Name').length).toBeGreaterThanOrEqual(1)
      })

      const aside = getDesktopAside(container)
      const renameBtn = within(aside).getByRole('button', {
        name: 'Rename conversation',
        hidden: true,
      })
      fireEvent.click(renameBtn)

      await waitFor(() => {
        expect(
          within(aside).getByLabelText('Rename conversation'),
        ).toBeInTheDocument()
      })

      const input = within(aside).getByLabelText('Rename conversation')
      fireEvent.change(input, { target: { value: 'New Name' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      // Verify the title was updated in Dexie
      await waitFor(async () => {
        const conv = await db.conversations.get(convId)
        expect(conv?.title).toBe('New Name')
      })
    })

    it('cancels rename on Escape and exits edit mode', async () => {
      await createConversation({ title: 'Keep This', modelConfig })
      const { container } = renderSidebar()

      await waitFor(() => {
        expect(screen.getAllByText('Keep This').length).toBeGreaterThanOrEqual(
          1,
        )
      })

      const aside = getDesktopAside(container)
      const renameBtn = within(aside).getByRole('button', {
        name: 'Rename conversation',
        hidden: true,
      })
      fireEvent.click(renameBtn)

      await waitFor(() => {
        expect(
          within(aside).getByLabelText('Rename conversation'),
        ).toBeInTheDocument()
      })

      const input = within(aside).getByLabelText('Rename conversation')
      // Don't change the value -- just press Escape to exit edit mode
      fireEvent.keyDown(input, { key: 'Escape' })

      // Should exit edit mode (rename input disappears, button remains)
      await waitFor(() => {
        expect(
          within(aside).queryByRole('textbox', { name: 'Rename conversation' }),
        ).not.toBeInTheDocument()
      })
    })

    it('does not update title when cancel button is clicked', async () => {
      const convId = await createConversation({
        title: 'Keep This',
        modelConfig,
      })
      const { container } = renderSidebar()

      await waitFor(() => {
        expect(screen.getAllByText('Keep This').length).toBeGreaterThanOrEqual(
          1,
        )
      })

      const aside = getDesktopAside(container)
      const renameBtn = within(aside).getByRole('button', {
        name: 'Rename conversation',
        hidden: true,
      })
      fireEvent.click(renameBtn)

      await waitFor(() => {
        const input = within(aside).queryByRole('textbox', { hidden: true })
        expect(input).toBeInTheDocument()
      })

      const input = within(aside).getByRole('textbox', { hidden: true })
      fireEvent.change(input, { target: { value: 'Changed' } })

      // Click the cancel (X) button -- uses onMouseDown preventDefault
      // to prevent blur from firing before cancel
      const cancelBtn = within(aside).getByRole('button', {
        name: 'Cancel rename',
        hidden: true,
      })
      fireEvent.mouseDown(cancelBtn)
      fireEvent.click(cancelBtn)

      // Should exit edit mode (input disappears, conversation item shows)
      await waitFor(() => {
        expect(
          within(aside).queryByRole('textbox', { hidden: true }),
        ).not.toBeInTheDocument()
      })

      // Title should NOT have been updated in Dexie
      const conv = await db.conversations.get(convId)
      expect(conv?.title).toBe('Keep This')
    })

    it('confirms rename on blur', async () => {
      const convId = await createConversation({
        title: 'Blur Test',
        modelConfig,
      })
      const { container } = renderSidebar()

      await waitFor(() => {
        expect(screen.getAllByText('Blur Test').length).toBeGreaterThanOrEqual(
          1,
        )
      })

      const aside = getDesktopAside(container)
      const renameBtn = within(aside).getByRole('button', {
        name: 'Rename conversation',
        hidden: true,
      })
      fireEvent.click(renameBtn)

      await waitFor(() => {
        expect(
          within(aside).getByLabelText('Rename conversation'),
        ).toBeInTheDocument()
      })

      const input = within(aside).getByLabelText('Rename conversation')
      fireEvent.change(input, { target: { value: 'Blurred Name' } })
      fireEvent.blur(input)

      // Verify the title was updated in Dexie
      await waitFor(async () => {
        const conv = await db.conversations.get(convId)
        expect(conv?.title).toBe('Blurred Name')
      })
    })

    it('rejects empty rename value and does not update the title', async () => {
      const convId = await createConversation({
        title: 'Non-Empty',
        modelConfig,
      })
      const { container } = renderSidebar()

      await waitFor(() => {
        expect(screen.getAllByText('Non-Empty').length).toBeGreaterThanOrEqual(
          1,
        )
      })

      const aside = getDesktopAside(container)
      const renameBtn = within(aside).getByRole('button', {
        name: 'Rename conversation',
        hidden: true,
      })
      fireEvent.click(renameBtn)

      await waitFor(() => {
        expect(
          within(aside).getByLabelText('Rename conversation'),
        ).toBeInTheDocument()
      })

      const input = within(aside).getByLabelText('Rename conversation')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      // The title should remain unchanged in Dexie
      await waitFor(async () => {
        const conv = await db.conversations.get(convId)
        expect(conv?.title).toBe('Non-Empty')
      })
    })

    it('does not update Dexie when rename value is same as current title', async () => {
      const convId = await createConversation({
        title: 'Same Title',
        modelConfig,
      })
      const { container } = renderSidebar()

      await waitFor(() => {
        expect(screen.getAllByText('Same Title').length).toBeGreaterThanOrEqual(
          1,
        )
      })

      const aside = getDesktopAside(container)

      // Get the updatedAt before rename attempt
      const before = await db.conversations.get(convId)
      const originalUpdatedAt = before?.updatedAt

      const renameBtn = within(aside).getByRole('button', {
        name: 'Rename conversation',
        hidden: true,
      })
      fireEvent.click(renameBtn)

      await waitFor(() => {
        expect(
          within(aside).getByLabelText('Rename conversation'),
        ).toBeInTheDocument()
      })

      const input = within(aside).getByLabelText('Rename conversation')
      // Don't change the value -- press Enter with the same title
      fireEvent.keyDown(input, { key: 'Enter' })

      // Title and updatedAt should not have changed
      const after = await db.conversations.get(convId)
      expect(after?.title).toBe('Same Title')
      expect(after?.updatedAt).toBe(originalUpdatedAt)
    })
  })

  describe('delete', () => {
    it('opens confirmation dialog when delete button is clicked', async () => {
      await createConversation({ title: 'Doomed Chat', modelConfig })
      const { container } = renderSidebar()

      await waitFor(() => {
        expect(
          screen.getAllByText('Doomed Chat').length,
        ).toBeGreaterThanOrEqual(1)
      })

      const aside = getDesktopAside(container)
      const deleteBtn = within(aside).getByRole('button', {
        name: 'Delete conversation',
        hidden: true,
      })
      fireEvent.click(deleteBtn)

      // The AlertDialog should open with the confirmation text
      await waitFor(() => {
        expect(screen.getByText('Delete conversation?')).toBeInTheDocument()
      })
    })

    it('shows the conversation title in the confirmation dialog', async () => {
      await createConversation({ title: 'Important Chat', modelConfig })
      const { container } = renderSidebar()

      await waitFor(() => {
        expect(
          screen.getAllByText('Important Chat').length,
        ).toBeGreaterThanOrEqual(1)
      })

      const aside = getDesktopAside(container)
      const deleteBtn = within(aside).getByRole('button', {
        name: 'Delete conversation',
        hidden: true,
      })
      fireEvent.click(deleteBtn)

      // Wait for the dialog to open first
      await waitFor(() => {
        expect(screen.getByText('Delete conversation?')).toBeInTheDocument()
      })

      // The dialog description contains the conversation title with curly quotes
      // Use a function matcher to check the text content includes the title
      expect(
        screen.getByText((_content, element) => {
          return (
            element?.tagName === 'P' &&
            (element?.textContent?.includes('Important Chat') ?? false)
          )
        }),
      ).toBeInTheDocument()
    })

    it('deletes the conversation from Dexie when confirmed', async () => {
      const convId = await createConversation({
        title: 'To Delete',
        modelConfig,
      })
      const { container } = renderSidebar()

      await waitFor(() => {
        expect(screen.getAllByText('To Delete').length).toBeGreaterThanOrEqual(
          1,
        )
      })

      const aside = getDesktopAside(container)
      const deleteBtn = within(aside).getByRole('button', {
        name: 'Delete conversation',
        hidden: true,
      })
      fireEvent.click(deleteBtn)

      await waitFor(() => {
        expect(screen.getByText('Delete conversation?')).toBeInTheDocument()
      })

      // Click the "Delete" confirmation button in the AlertDialog
      const confirmBtn = screen.getByRole('button', { name: 'Delete' })
      fireEvent.click(confirmBtn)

      // Verify the conversation was deleted from Dexie
      await waitFor(async () => {
        const conv = await db.conversations.get(convId)
        expect(conv).toBeUndefined()
      })
    })

    it('closes the dialog without deleting when Cancel is clicked', async () => {
      const convId = await createConversation({
        title: 'Safe Chat',
        modelConfig,
      })
      const { container } = renderSidebar()

      await waitFor(() => {
        expect(screen.getAllByText('Safe Chat').length).toBeGreaterThanOrEqual(
          1,
        )
      })

      const aside = getDesktopAside(container)
      const deleteBtn = within(aside).getByRole('button', {
        name: 'Delete conversation',
        hidden: true,
      })
      fireEvent.click(deleteBtn)

      await waitFor(() => {
        expect(screen.getByText('Delete conversation?')).toBeInTheDocument()
      })

      // Click "Cancel"
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
      fireEvent.click(cancelBtn)

      // Dialog should close
      await waitFor(() => {
        expect(
          screen.queryByText('Delete conversation?'),
        ).not.toBeInTheDocument()
      })

      // Conversation should still exist in Dexie
      const conv = await db.conversations.get(convId)
      expect(conv).toBeDefined()
      expect(conv?.title).toBe('Safe Chat')
    })

    it('clears activeConversationId when the active conversation is deleted', async () => {
      const convId = await createConversation({
        title: 'Active Chat',
        modelConfig,
      })

      // Set this conversation as active
      useAppStore.setState({ activeConversationId: convId })

      const { container } = renderSidebar()

      await waitFor(() => {
        expect(
          screen.getAllByText('Active Chat').length,
        ).toBeGreaterThanOrEqual(1)
      })

      const aside = getDesktopAside(container)
      const deleteBtn = within(aside).getByRole('button', {
        name: 'Delete conversation',
        hidden: true,
      })
      fireEvent.click(deleteBtn)

      await waitFor(() => {
        expect(screen.getByText('Delete conversation?')).toBeInTheDocument()
      })

      const confirmBtn = screen.getByRole('button', { name: 'Delete' })
      fireEvent.click(confirmBtn)

      // activeConversationId should be cleared
      await waitFor(() => {
        expect(useAppStore.getState().activeConversationId).toBeNull()
      })
    })

    it('does not clear activeConversationId when a non-active conversation is deleted', async () => {
      const activeId = await createConversation({
        title: 'Active Conv',
        modelConfig,
      })
      const otherId = await createConversation({
        title: 'Other Conv',
        modelConfig,
      })

      // Set one conversation as active, delete the other
      useAppStore.setState({ activeConversationId: activeId })

      const { container } = renderSidebar()

      await waitFor(() => {
        expect(screen.getAllByText('Other Conv').length).toBeGreaterThanOrEqual(
          1,
        )
      })

      const aside = getDesktopAside(container)
      // Find the delete button for "Other Conv" -- both items have delete buttons,
      // so we need to find the one within the correct conversation item.
      // The conversation items are role="button" divs with the title text.
      const otherItem = within(aside).getAllByRole('button', {
        name: 'Delete conversation',
        hidden: true,
      })

      // There should be 2 delete buttons (one per conversation).
      // We need the one for "Other Conv". Since conversations are ordered by
      // updatedAt desc, "Other Conv" (created later) should be first.
      fireEvent.click(otherItem[0])

      await waitFor(() => {
        expect(screen.getByText('Delete conversation?')).toBeInTheDocument()
      })

      const confirmBtn = screen.getByRole('button', { name: 'Delete' })
      fireEvent.click(confirmBtn)

      // The other conversation should be deleted
      await waitFor(async () => {
        const conv = await db.conversations.get(otherId)
        expect(conv).toBeUndefined()
      })

      // activeConversationId should remain set to the active conversation
      expect(useAppStore.getState().activeConversationId).toBe(activeId)
    })
  })
})
