import { cn, generateTitle } from '@/lib/utils'

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

describe('generateTitle()', () => {
  it('returns short text (under 60 chars) as-is', () => {
    expect(generateTitle('Hello world')).toBe('Hello world')
  })

  it('returns text exactly at 60 chars without truncation', () => {
    const text = 'a'.repeat(60)
    expect(generateTitle(text)).toBe(text)
    expect(generateTitle(text).length).toBe(60)
  })

  it('truncates long text at word boundary with "..."', () => {
    // 68 characters total: words that exceed 60 chars
    const text =
      'The quick brown fox jumps over the lazy dog and runs across the field'
    const result = generateTitle(text)
    expect(result.endsWith('...')).toBe(true)
    // Should not exceed 63 chars (60 + "...")
    expect(result.length).toBeLessThanOrEqual(63)
    // The truncation should end at a word boundary (space before "..."),
    // meaning a complete word precedes the ellipsis
    expect(result).toBe(
      'The quick brown fox jumps over the lazy dog and runs across...',
    )
  })

  it('replaces newlines with spaces', () => {
    expect(generateTitle('Hello\nworld')).toBe('Hello world')
    expect(generateTitle('Line one\n\nLine two')).toBe('Line one Line two')
  })

  it('trims leading and trailing whitespace', () => {
    expect(generateTitle('  Hello world  ')).toBe('Hello world')
    expect(generateTitle('\n\nHello\n\n')).toBe('Hello')
  })

  it('hard-truncates very long single word with "..."', () => {
    const longWord = 'a'.repeat(80)
    const result = generateTitle(longWord)
    expect(result).toBe('a'.repeat(60) + '...')
  })

  it('returns empty string for empty input', () => {
    expect(generateTitle('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(generateTitle('   ')).toBe('')
    expect(generateTitle('\n\n')).toBe('')
  })

  it('truncates at a word boundary close to 60 chars, not too early', () => {
    // Build a string where truncation at word boundary is around char 55
    const text = 'word '.repeat(13) // "word word word ..." = 65 chars
    const result = generateTitle(text.trim())
    expect(result.endsWith('...')).toBe(true)
    // The result (without "...") should be reasonably close to 60 chars
    const contentLength = result.length - 3
    expect(contentLength).toBeGreaterThan(60 * 0.4) // Not truncated too early
  })

  it('handles text with multiple consecutive spaces after newline replacement', () => {
    // Newlines replaced with spaces; multiple spaces from adjacent newlines
    const text = 'Hello\n\n\nworld this is a short message'
    const result = generateTitle(text)
    expect(result).toBe('Hello world this is a short message')
  })
})
