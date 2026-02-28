import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

describe('Button', () => {
  it('renders with children text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('renders as disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled()
  })

  it('applies custom className', () => {
    render(<Button className="custom-class">Styled</Button>)
    expect(screen.getByRole('button', { name: 'Styled' })).toHaveClass(
      'custom-class',
    )
  })

  it('exposes data-slot attribute', () => {
    render(<Button>Slot</Button>)
    expect(screen.getByRole('button', { name: 'Slot' })).toHaveAttribute(
      'data-slot',
      'button',
    )
  })

  it('exposes data-variant attribute for default variant', () => {
    render(<Button>Default</Button>)
    expect(screen.getByRole('button', { name: 'Default' })).toHaveAttribute(
      'data-variant',
      'default',
    )
  })

  it('exposes data-variant attribute for destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute(
      'data-variant',
      'destructive',
    )
  })
})

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Type here" />)
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument()
  })

  it('renders as disabled when disabled prop is set', () => {
    render(<Input disabled placeholder="Disabled" />)
    expect(screen.getByPlaceholderText('Disabled')).toBeDisabled()
  })

  it('applies custom className', () => {
    render(<Input className="my-input" placeholder="Styled" />)
    expect(screen.getByPlaceholderText('Styled')).toHaveClass('my-input')
  })

  it('exposes data-slot attribute', () => {
    render(<Input placeholder="Slot" />)
    expect(screen.getByPlaceholderText('Slot')).toHaveAttribute(
      'data-slot',
      'input',
    )
  })

  it('supports type prop', () => {
    render(<Input type="password" placeholder="Password" />)
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute(
      'type',
      'password',
    )
  })
})

describe('ScrollArea', () => {
  it('renders children content', () => {
    render(
      <ScrollArea>
        <p>Scrollable content</p>
      </ScrollArea>,
    )
    expect(screen.getByText('Scrollable content')).toBeInTheDocument()
  })

  it('exposes data-slot attribute', () => {
    const { container } = render(
      <ScrollArea>
        <p>Content</p>
      </ScrollArea>,
    )
    expect(
      container.querySelector('[data-slot="scroll-area"]'),
    ).toBeInTheDocument()
  })
})

describe('Dialog', () => {
  it('renders trigger and opens content on click', async () => {
    const { user } = renderWithUser(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogHeader>
          <p>Dialog body</p>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByText('Open Dialog')).toBeInTheDocument()
    expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument()

    await user.click(screen.getByText('Open Dialog'))

    expect(screen.getByText('Test Dialog')).toBeInTheDocument()
    expect(screen.getByText('Dialog body')).toBeInTheDocument()
  })

  it('renders close button inside content by default', async () => {
    const { user } = renderWithUser(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    await user.click(screen.getByText('Open'))

    expect(screen.getByText('Close')).toBeInTheDocument()
  })
})

describe('Sheet', () => {
  it('renders trigger and opens content on click', async () => {
    const { user } = renderWithUser(
      <Sheet>
        <SheetTrigger>Open Sheet</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Test Sheet</SheetTitle>
          </SheetHeader>
          <p>Sheet body</p>
        </SheetContent>
      </Sheet>,
    )

    expect(screen.getByText('Open Sheet')).toBeInTheDocument()
    expect(screen.queryByText('Test Sheet')).not.toBeInTheDocument()

    await user.click(screen.getByText('Open Sheet'))

    expect(screen.getByText('Test Sheet')).toBeInTheDocument()
    expect(screen.getByText('Sheet body')).toBeInTheDocument()
  })

  it('renders close button inside content by default', async () => {
    const { user } = renderWithUser(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Title</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    )

    await user.click(screen.getByText('Open'))

    expect(screen.getByText('Close')).toBeInTheDocument()
  })
})

function renderWithUser(ui: React.ReactElement) {
  const user = userEvent.setup()
  const result = render(ui)
  return { ...result, user }
}
