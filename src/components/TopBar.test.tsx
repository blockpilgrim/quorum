import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopBar } from '@/components/TopBar'
import { useAppStore } from '@/lib/store'

beforeEach(() => {
  useAppStore.setState({ activeConversationId: null, sidebarOpen: false })
})

describe('TopBar', () => {
  it('renders title and action buttons', () => {
    render(<TopBar onNewConversation={vi.fn()} />)
    expect(screen.getByText('Cortex')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Toggle sidebar' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'New conversation' }),
    ).toBeInTheDocument()
  })

  it('toggles sidebarOpen in Zustand when sidebar toggle is clicked', async () => {
    const user = userEvent.setup()
    render(<TopBar onNewConversation={vi.fn()} />)

    expect(useAppStore.getState().sidebarOpen).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }))
    expect(useAppStore.getState().sidebarOpen).toBe(true)
  })
})
