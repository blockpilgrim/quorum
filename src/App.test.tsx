import { render, screen } from '@testing-library/react'
import App from '@/App'

describe('App', () => {
  it('renders the Cortex heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cortex' }),
    ).toBeInTheDocument()
  })

  it('renders the tagline', () => {
    render(<App />)
    expect(
      screen.getByText('Unified Tri-Model AI Workspace'),
    ).toBeInTheDocument()
  })

  it('renders all three model columns', () => {
    render(<App />)
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('ChatGPT')).toBeInTheDocument()
    expect(screen.getByText('Gemini')).toBeInTheDocument()
  })

  it('renders the input bar with placeholder text', () => {
    render(<App />)
    const input = screen.getByPlaceholderText('Ask all three models...')
    expect(input).toBeInTheDocument()
    expect(input).toBeDisabled()
  })

  it('renders a disabled Send button', () => {
    render(<App />)
    const button = screen.getByRole('button', { name: 'Send' })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('renders the phase 1 status message', () => {
    render(<App />)
    expect(
      screen.getByText('Phase 1 scaffold complete. Dev environment ready.'),
    ).toBeInTheDocument()
  })
})
