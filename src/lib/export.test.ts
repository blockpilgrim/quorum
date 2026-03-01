/**
 * Unit tests for the export serialization module.
 *
 * Covers:
 * - sanitizeFilename: special char removal, lowercasing, spaces to hyphens, truncation
 * - buildExportFilename: correct format cortex-{title}-{YYYY-MM-DD}.{ext}
 * - exportConversationToJson: valid JSON output with correct structure
 * - exportAllConversationsToJson: array of conversations
 * - exportConversationToMarkdown: per-provider sections, interleaved timeline
 * - exportAllConversationsToMarkdown: multiple conversations with separators
 * - Edge cases: empty messages, special characters, cross-feed messages
 */

import type { Conversation, Message } from '@/lib/db/types'
import {
  sanitizeFilename,
  buildExportFilename,
  exportConversationToJson,
  exportAllConversationsToJson,
  exportConversationToMarkdown,
  exportAllConversationsToMarkdown,
  type ExportableConversation,
  type ConversationExportJson,
} from '@/lib/export'

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function makeConversation(overrides?: Partial<Conversation>): Conversation {
  return {
    id: 1,
    title: 'Test Conversation',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T11:00:00.000Z',
    modelConfig: {
      claude: 'claude-sonnet-4-6',
      chatgpt: 'gpt-5.2',
      gemini: 'gemini-2.5-flash',
    },
    ...overrides,
  }
}

function makeMessage(
  overrides: Partial<Message> & { role: Message['role'] },
): Message {
  return {
    conversationId: 1,
    provider: 'claude',
    role: overrides.role,
    content: overrides.content ?? 'Test content',
    timestamp: overrides.timestamp ?? '2026-03-01T12:00:00.000Z',
    tokenCount: overrides.tokenCount ?? null,
    isCrossFeed: overrides.isCrossFeed ?? false,
    crossFeedRound: overrides.crossFeedRound ?? null,
    ...overrides,
  }
}

function makeExportable(
  conversationOverrides?: Partial<Conversation>,
  messages?: Message[],
): ExportableConversation {
  return {
    conversation: makeConversation(conversationOverrides),
    messages: messages ?? [],
  }
}

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------

describe('sanitizeFilename', () => {
  it('lowercases the input', () => {
    expect(sanitizeFilename('Hello World')).toBe('hello-world')
  })

  it('replaces spaces with hyphens', () => {
    expect(sanitizeFilename('my great conversation')).toBe(
      'my-great-conversation',
    )
  })

  it('removes special characters', () => {
    expect(sanitizeFilename('hello@world#2026!')).toBe('helloworld2026')
  })

  it('collapses multiple spaces into a single hyphen', () => {
    expect(sanitizeFilename('a   b    c')).toBe('a-b-c')
  })

  it('collapses multiple hyphens into a single hyphen', () => {
    expect(sanitizeFilename('a---b---c')).toBe('a-b-c')
  })

  it('removes leading and trailing hyphens', () => {
    expect(sanitizeFilename('--hello--')).toBe('hello')
  })

  it('truncates to 50 characters', () => {
    const longInput = 'a'.repeat(100)
    expect(sanitizeFilename(longInput).length).toBe(50)
  })

  it('handles an empty string', () => {
    expect(sanitizeFilename('')).toBe('')
  })

  it('handles a string of only special characters', () => {
    expect(sanitizeFilename('!@#$%^&*()')).toBe('')
  })

  it('preserves numbers', () => {
    expect(sanitizeFilename('conversation 42')).toBe('conversation-42')
  })

  it('handles mixed special chars, spaces, and hyphens', () => {
    expect(sanitizeFilename('My Chat! -- About #AI')).toBe('my-chat-about-ai')
  })

  it('handles unicode/accented characters by removing them', () => {
    expect(sanitizeFilename('cafe resume')).toBe('cafe-resume')
    // Combining accent marks (U+0301) are stripped, but base letters remain
    // 'cafe\u0301' = 'caf' + 'e' + combining accent -> accent stripped, 'e' kept
    expect(sanitizeFilename('caf\u00e9 r\u00e9sum\u00e9')).toBe('caf-rsum')
  })
})

// ---------------------------------------------------------------------------
// buildExportFilename
// ---------------------------------------------------------------------------

describe('buildExportFilename', () => {
  it('produces the correct format for json', () => {
    const filename = buildExportFilename('My Chat', 'json')
    // Pattern: cortex-{sanitized-title}-{YYYY-MM-DD}.json
    expect(filename).toMatch(/^cortex-my-chat-\d{4}-\d{2}-\d{2}\.json$/)
  })

  it('produces the correct format for md', () => {
    const filename = buildExportFilename('My Chat', 'md')
    expect(filename).toMatch(/^cortex-my-chat-\d{4}-\d{2}-\d{2}\.md$/)
  })

  it('sanitizes the title in the filename', () => {
    const filename = buildExportFilename('Hello World!!! @#$', 'json')
    expect(filename).toMatch(/^cortex-hello-world-\d{4}-\d{2}-\d{2}\.json$/)
  })

  it('handles an empty title gracefully', () => {
    const filename = buildExportFilename('', 'json')
    // When sanitized title is empty, should be cortex-{date}.json
    expect(filename).toMatch(/^cortex-\d{4}-\d{2}-\d{2}\.json$/)
    expect(filename).not.toContain('--')
  })

  it('handles a title of only special characters', () => {
    const filename = buildExportFilename('!@#$%', 'md')
    expect(filename).toMatch(/^cortex-\d{4}-\d{2}-\d{2}\.md$/)
  })

  it('includes today date in YYYY-MM-DD format', () => {
    const today = new Date().toISOString().slice(0, 10)
    const filename = buildExportFilename('test', 'json')
    expect(filename).toContain(today)
  })
})

// ---------------------------------------------------------------------------
// exportConversationToJson
// ---------------------------------------------------------------------------

describe('exportConversationToJson', () => {
  it('returns valid JSON', () => {
    const data = makeExportable()
    const result = exportConversationToJson(data)
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('includes conversation metadata', () => {
    const data = makeExportable({
      id: 42,
      title: 'Test Title',
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T11:00:00.000Z',
    })
    const parsed: ConversationExportJson = JSON.parse(
      exportConversationToJson(data),
    )

    expect(parsed.id).toBe(42)
    expect(parsed.title).toBe('Test Title')
    expect(parsed.createdAt).toBe('2026-03-01T10:00:00.000Z')
    expect(parsed.updatedAt).toBe('2026-03-01T11:00:00.000Z')
  })

  it('includes modelConfig', () => {
    const data = makeExportable()
    const parsed: ConversationExportJson = JSON.parse(
      exportConversationToJson(data),
    )

    expect(parsed.modelConfig).toEqual({
      claude: 'claude-sonnet-4-6',
      chatgpt: 'gpt-5.2',
      gemini: 'gemini-2.5-flash',
    })
  })

  it('includes messages with all fields', () => {
    const messages: Message[] = [
      makeMessage({
        id: 1,
        role: 'user',
        content: 'Hello',
        provider: 'claude',
        timestamp: '2026-03-01T12:00:00.000Z',
      }),
      makeMessage({
        id: 2,
        role: 'assistant',
        content: 'Hi there!',
        provider: 'claude',
        timestamp: '2026-03-01T12:00:01.000Z',
        tokenCount: { input: 10, output: 20 },
      }),
    ]
    const data = makeExportable(undefined, messages)
    const parsed: ConversationExportJson = JSON.parse(
      exportConversationToJson(data),
    )

    expect(parsed.messages).toHaveLength(2)

    expect(parsed.messages[0]).toEqual({
      id: 1,
      provider: 'claude',
      role: 'user',
      content: 'Hello',
      timestamp: '2026-03-01T12:00:00.000Z',
      tokenCount: null,
      isCrossFeed: false,
      crossFeedRound: null,
    })

    expect(parsed.messages[1]).toEqual({
      id: 2,
      provider: 'claude',
      role: 'assistant',
      content: 'Hi there!',
      timestamp: '2026-03-01T12:00:01.000Z',
      tokenCount: { input: 10, output: 20 },
      isCrossFeed: false,
      crossFeedRound: null,
    })
  })

  it('handles cross-feed messages', () => {
    const messages: Message[] = [
      makeMessage({
        id: 3,
        role: 'user',
        content: 'Cross-feed content',
        provider: 'claude',
        isCrossFeed: true,
        crossFeedRound: 2,
      }),
    ]
    const data = makeExportable(undefined, messages)
    const parsed: ConversationExportJson = JSON.parse(
      exportConversationToJson(data),
    )

    expect(parsed.messages[0].isCrossFeed).toBe(true)
    expect(parsed.messages[0].crossFeedRound).toBe(2)
  })

  it('handles empty messages array', () => {
    const data = makeExportable(undefined, [])
    const parsed: ConversationExportJson = JSON.parse(
      exportConversationToJson(data),
    )

    expect(parsed.messages).toEqual([])
  })

  it('is pretty-printed with 2-space indentation', () => {
    const data = makeExportable()
    const result = exportConversationToJson(data)
    // JSON.stringify with null, 2 produces 2-space indentation
    expect(result).toContain('  ')
    expect(result.split('\n').length).toBeGreaterThan(1)
  })

  it('preserves special characters in content', () => {
    const messages: Message[] = [
      makeMessage({
        role: 'user',
        content: 'Contains "quotes" and <html> & special\nchars',
      }),
    ]
    const data = makeExportable(undefined, messages)
    const parsed: ConversationExportJson = JSON.parse(
      exportConversationToJson(data),
    )

    expect(parsed.messages[0].content).toBe(
      'Contains "quotes" and <html> & special\nchars',
    )
  })

  it('handles messages from multiple providers', () => {
    const messages: Message[] = [
      makeMessage({ role: 'user', provider: 'claude', content: 'Q' }),
      makeMessage({
        role: 'assistant',
        provider: 'claude',
        content: 'Claude answer',
      }),
      makeMessage({ role: 'user', provider: 'chatgpt', content: 'Q' }),
      makeMessage({
        role: 'assistant',
        provider: 'chatgpt',
        content: 'GPT answer',
      }),
      makeMessage({ role: 'user', provider: 'gemini', content: 'Q' }),
      makeMessage({
        role: 'assistant',
        provider: 'gemini',
        content: 'Gemini answer',
      }),
    ]
    const data = makeExportable(undefined, messages)
    const parsed: ConversationExportJson = JSON.parse(
      exportConversationToJson(data),
    )

    expect(parsed.messages).toHaveLength(6)
    expect(parsed.messages.map((m) => m.provider)).toEqual([
      'claude',
      'claude',
      'chatgpt',
      'chatgpt',
      'gemini',
      'gemini',
    ])
  })
})

// ---------------------------------------------------------------------------
// exportAllConversationsToJson
// ---------------------------------------------------------------------------

describe('exportAllConversationsToJson', () => {
  it('returns valid JSON', () => {
    const data = [makeExportable({ id: 1 }), makeExportable({ id: 2 })]
    const result = exportAllConversationsToJson(data)
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('returns a JSON array of conversations', () => {
    const data = [
      makeExportable({ id: 1, title: 'First' }),
      makeExportable({ id: 2, title: 'Second' }),
    ]
    const parsed = JSON.parse(exportAllConversationsToJson(data))

    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].title).toBe('First')
    expect(parsed[1].title).toBe('Second')
  })

  it('handles an empty array', () => {
    const parsed = JSON.parse(exportAllConversationsToJson([]))
    expect(parsed).toEqual([])
  })

  it('includes messages in each conversation', () => {
    const data = [
      makeExportable({ id: 1 }, [
        makeMessage({ role: 'user', content: 'Hello from conv 1' }),
      ]),
      makeExportable({ id: 2 }, [
        makeMessage({ role: 'user', content: 'Hello from conv 2' }),
      ]),
    ]
    const parsed = JSON.parse(exportAllConversationsToJson(data))

    expect(parsed[0].messages[0].content).toBe('Hello from conv 1')
    expect(parsed[1].messages[0].content).toBe('Hello from conv 2')
  })

  it('handles single conversation in the array', () => {
    const data = [makeExportable({ id: 1, title: 'Solo' })]
    const parsed = JSON.parse(exportAllConversationsToJson(data))

    expect(parsed).toHaveLength(1)
    expect(parsed[0].title).toBe('Solo')
  })
})

// ---------------------------------------------------------------------------
// exportConversationToMarkdown
// ---------------------------------------------------------------------------

describe('exportConversationToMarkdown', () => {
  it('includes the conversation title as h1', () => {
    const data = makeExportable({ title: 'My Chat' })
    const md = exportConversationToMarkdown(data)
    expect(md).toContain('# My Chat')
  })

  it('includes created and updated timestamps', () => {
    const data = makeExportable({
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T11:00:00.000Z',
    })
    const md = exportConversationToMarkdown(data)
    expect(md).toContain('Created:')
    expect(md).toContain('Updated:')
  })

  it('includes per-provider sections with correct headings', () => {
    const messages: Message[] = [
      makeMessage({ role: 'user', provider: 'claude', content: 'Q' }),
      makeMessage({
        role: 'assistant',
        provider: 'claude',
        content: 'A from Claude',
      }),
      makeMessage({ role: 'user', provider: 'chatgpt', content: 'Q' }),
      makeMessage({
        role: 'assistant',
        provider: 'chatgpt',
        content: 'A from ChatGPT',
      }),
      makeMessage({ role: 'user', provider: 'gemini', content: 'Q' }),
      makeMessage({
        role: 'assistant',
        provider: 'gemini',
        content: 'A from Gemini',
      }),
    ]
    const data = makeExportable(undefined, messages)
    const md = exportConversationToMarkdown(data)

    expect(md).toContain('## Claude Thread')
    expect(md).toContain('## ChatGPT Thread')
    expect(md).toContain('## Gemini Thread')
  })

  it('includes an interleaved timeline section', () => {
    const messages: Message[] = [
      makeMessage({
        role: 'user',
        provider: 'claude',
        content: 'Hello',
        timestamp: '2026-03-01T12:00:00.000Z',
      }),
    ]
    const data = makeExportable(undefined, messages)
    const md = exportConversationToMarkdown(data)

    expect(md).toContain('## Interleaved Timeline')
  })

  it('formats user messages with "User" label', () => {
    const messages: Message[] = [
      makeMessage({
        role: 'user',
        provider: 'claude',
        content: 'My question',
      }),
    ]
    const data = makeExportable(undefined, messages)
    const md = exportConversationToMarkdown(data)

    expect(md).toContain('**User**')
    expect(md).toContain('My question')
  })

  it('formats assistant messages with provider label', () => {
    const messages: Message[] = [
      makeMessage({
        role: 'assistant',
        provider: 'claude',
        content: 'Claude response',
      }),
    ]
    const data = makeExportable(undefined, messages)
    const md = exportConversationToMarkdown(data)

    expect(md).toContain('**Claude**')
    expect(md).toContain('Claude response')
  })

  it('tags cross-feed messages with [Cross-feed]', () => {
    const messages: Message[] = [
      makeMessage({
        role: 'user',
        provider: 'claude',
        content: 'Cross-feed input',
        isCrossFeed: true,
        crossFeedRound: 1,
      }),
    ]
    const data = makeExportable(undefined, messages)
    const md = exportConversationToMarkdown(data)

    expect(md).toContain('[Cross-feed]')
    expect(md).toContain('(Round 1)')
  })

  it('does not tag non-cross-feed messages', () => {
    const messages: Message[] = [
      makeMessage({
        role: 'user',
        provider: 'claude',
        content: 'Normal message',
        isCrossFeed: false,
        crossFeedRound: null,
      }),
    ]
    const data = makeExportable(undefined, messages)
    const md = exportConversationToMarkdown(data)

    expect(md).not.toContain('[Cross-feed]')
    expect(md).not.toMatch(/\(Round \d+\)/)
  })

  it('omits provider sections with no messages', () => {
    const messages: Message[] = [
      makeMessage({
        role: 'user',
        provider: 'claude',
        content: 'Only Claude',
      }),
    ]
    const data = makeExportable(undefined, messages)
    const md = exportConversationToMarkdown(data)

    expect(md).toContain('## Claude Thread')
    expect(md).not.toContain('## ChatGPT Thread')
    expect(md).not.toContain('## Gemini Thread')
  })

  it('separates messages with horizontal rules', () => {
    const messages: Message[] = [
      makeMessage({ role: 'user', provider: 'claude', content: 'Q1' }),
      makeMessage({ role: 'assistant', provider: 'claude', content: 'A1' }),
    ]
    const data = makeExportable(undefined, messages)
    const md = exportConversationToMarkdown(data)

    expect(md).toContain('---')
  })

  it('handles empty messages array', () => {
    const data = makeExportable(undefined, [])
    const md = exportConversationToMarkdown(data)

    expect(md).toContain('# Test Conversation')
    // No provider sections
    expect(md).not.toContain('## Claude Thread')
    expect(md).not.toContain('## ChatGPT Thread')
    expect(md).not.toContain('## Gemini Thread')
    // No interleaved timeline
    expect(md).not.toContain('## Interleaved Timeline')
  })

  it('sorts interleaved timeline by timestamp', () => {
    const messages: Message[] = [
      makeMessage({
        role: 'assistant',
        provider: 'gemini',
        content: 'Gemini answer (third)',
        timestamp: '2026-03-01T12:00:03.000Z',
      }),
      makeMessage({
        role: 'user',
        provider: 'claude',
        content: 'User question (first)',
        timestamp: '2026-03-01T12:00:01.000Z',
      }),
      makeMessage({
        role: 'assistant',
        provider: 'claude',
        content: 'Claude answer (second)',
        timestamp: '2026-03-01T12:00:02.000Z',
      }),
    ]
    const data = makeExportable(undefined, messages)
    const md = exportConversationToMarkdown(data)

    // In the interleaved timeline section, find the content positions
    const timelineStart = md.indexOf('## Interleaved Timeline')
    const timeline = md.slice(timelineStart)

    const firstPos = timeline.indexOf('User question (first)')
    const secondPos = timeline.indexOf('Claude answer (second)')
    const thirdPos = timeline.indexOf('Gemini answer (third)')

    expect(firstPos).toBeLessThan(secondPos)
    expect(secondPos).toBeLessThan(thirdPos)
  })

  it('uses provider name as label for assistant messages in interleaved timeline', () => {
    const messages: Message[] = [
      makeMessage({
        role: 'assistant',
        provider: 'chatgpt',
        content: 'GPT response',
        timestamp: '2026-03-01T12:00:01.000Z',
      }),
    ]
    const data = makeExportable(undefined, messages)
    const md = exportConversationToMarkdown(data)

    const timelineStart = md.indexOf('## Interleaved Timeline')
    const timeline = md.slice(timelineStart)
    // Assistant messages in timeline show provider as bold label (no duplicate bracket tag)
    expect(timeline).toContain('**ChatGPT**')
    expect(timeline).not.toContain('[ChatGPT]')
  })

  it('preserves message content with special characters', () => {
    const messages: Message[] = [
      makeMessage({
        role: 'user',
        provider: 'claude',
        content:
          'Code block:\n```js\nconsole.log("hello")\n```\nAnd **bold** text.',
      }),
    ]
    const data = makeExportable(undefined, messages)
    const md = exportConversationToMarkdown(data)

    expect(md).toContain('```js')
    expect(md).toContain('console.log("hello")')
    expect(md).toContain('**bold**')
  })
})

// ---------------------------------------------------------------------------
// exportAllConversationsToMarkdown
// ---------------------------------------------------------------------------

describe('exportAllConversationsToMarkdown', () => {
  it('combines multiple conversations with separator', () => {
    const data = [
      makeExportable({ title: 'First Chat' }, [
        makeMessage({ role: 'user', content: 'Hello first' }),
      ]),
      makeExportable({ title: 'Second Chat' }, [
        makeMessage({ role: 'user', content: 'Hello second' }),
      ]),
    ]
    const md = exportAllConversationsToMarkdown(data)

    expect(md).toContain('# First Chat')
    expect(md).toContain('# Second Chat')
    expect(md).toContain('Hello first')
    expect(md).toContain('Hello second')
  })

  it('separates conversations with horizontal rules', () => {
    const data = [
      makeExportable({ title: 'First' }),
      makeExportable({ title: 'Second' }),
    ]
    const md = exportAllConversationsToMarkdown(data)

    // The separator between conversations is \n\n---\n\n
    const firstEnd = md.indexOf('# First')
    const secondStart = md.indexOf('# Second')
    const between = md.slice(firstEnd, secondStart)
    expect(between).toContain('---')
  })

  it('handles a single conversation', () => {
    const data = [makeExportable({ title: 'Only One' })]
    const md = exportAllConversationsToMarkdown(data)

    expect(md).toContain('# Only One')
  })

  it('handles an empty array', () => {
    const md = exportAllConversationsToMarkdown([])
    expect(md).toBe('')
  })

  it('each conversation has its own provider sections', () => {
    const data = [
      makeExportable({ id: 1, title: 'Conv A' }, [
        makeMessage({
          role: 'assistant',
          provider: 'claude',
          content: 'Claude in A',
        }),
      ]),
      makeExportable({ id: 2, title: 'Conv B' }, [
        makeMessage({
          role: 'assistant',
          provider: 'gemini',
          content: 'Gemini in B',
        }),
      ]),
    ]
    const md = exportAllConversationsToMarkdown(data)

    // Conv A has Claude thread but not Gemini
    const convAStart = md.indexOf('# Conv A')
    const convBStart = md.indexOf('# Conv B')
    const convA = md.slice(convAStart, convBStart)
    const convB = md.slice(convBStart)

    expect(convA).toContain('## Claude Thread')
    expect(convA).not.toContain('## Gemini Thread')
    expect(convB).toContain('## Gemini Thread')
    expect(convB).not.toContain('## Claude Thread')
  })
})
