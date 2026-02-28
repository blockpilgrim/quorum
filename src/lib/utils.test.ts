import { cn } from '@/lib/utils'

describe('cn()', () => {
  it('merges multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes via clsx syntax', () => {
    const isHidden = false
    const isVisible = true
    expect(cn('base', isHidden && 'hidden', 'extra')).toBe('base extra')
    expect(cn('base', isVisible && 'visible', 'extra')).toBe(
      'base visible extra',
    )
  })

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('deduplicates conflicting Tailwind color classes', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })

  it('merges non-conflicting Tailwind classes without dropping any', () => {
    expect(cn('p-4', 'mx-2', 'text-sm')).toBe('p-4 mx-2 text-sm')
  })

  it('handles undefined, null, and empty string inputs', () => {
    expect(cn(undefined, null, '', 'valid')).toBe('valid')
  })

  it('handles no arguments', () => {
    expect(cn()).toBe('')
  })

  it('handles array inputs (clsx feature)', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
  })

  it('handles object inputs (clsx feature)', () => {
    expect(cn({ hidden: true, flex: false }, 'text-sm')).toBe('hidden text-sm')
  })

  it('resolves complex Tailwind conflicts across axes', () => {
    // px and py should not conflict with each other
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
    // but px-4 and px-2 should conflict
    expect(cn('px-4', 'px-2')).toBe('px-2')
  })
})
