/**
 * Tests for the Cloudflare Pages Function API proxy (POST /api/chat).
 *
 * Minimal viable tests: CORS, validation, provider routing, streaming,
 * error mapping (one per category), and onError callback.
 */

import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before the module under test is imported
// ---------------------------------------------------------------------------

const mockStreamText = vi.fn()
vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
}))

const mockAnthropicModel = vi.fn()
const mockCreateAnthropic = vi.fn(() => mockAnthropicModel)
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: (...args: unknown[]) => mockCreateAnthropic(...args),
}))

const mockOpenAIModel = vi.fn()
const mockCreateOpenAI = vi.fn(() => mockOpenAIModel)
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (...args: unknown[]) => mockCreateOpenAI(...args),
}))

const mockGoogleModel = vi.fn()
const mockCreateGoogle = vi.fn(() => mockGoogleModel)
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: (...args: unknown[]) => mockCreateGoogle(...args),
}))

// ---------------------------------------------------------------------------
// Import the module under test (after mocks are declared)
// ---------------------------------------------------------------------------

import { onRequestPost, onRequestOptions } from './chat'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    provider: 'claude',
    model: 'claude-sonnet-4-6',
    messages: [{ role: 'user', content: 'Hello' }],
    apiKey: 'sk-test-key-123',
    ...overrides,
  }
}

function createMockContext(body: unknown): { request: Request } {
  const request = new Request('https://example.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { request }
}

function createInvalidJsonContext(): { request: Request } {
  const request = new Request('https://example.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not valid json {{{',
  })
  return { request }
}

async function parseResponseBody(
  response: Response,
): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>
}

function setupStreamTextSuccess(responseBody = 'Hello from AI') {
  const mockResponse = new Response(responseBody, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
  mockStreamText.mockReturnValue({
    toUIMessageStreamResponse: vi.fn(() => mockResponse),
  })
  return mockResponse
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockAnthropicModel.mockReturnValue('anthropic-model-instance')
  mockOpenAIModel.mockReturnValue('openai-model-instance')
  mockGoogleModel.mockReturnValue('google-model-instance')
})

describe('CORS preflight', () => {
  it('returns 204 with all required CORS headers', async () => {
    const response = await onRequestOptions(
      {} as Parameters<typeof onRequestOptions>[0],
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'POST, OPTIONS',
    )
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
      'Content-Type',
    )
  })
})

describe('request validation', () => {
  it('returns 400 for invalid JSON', async () => {
    const context = createInvalidJsonContext()
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(response.status).toBe(400)
    const body = await parseResponseBody(response)
    expect((body.error as Record<string, unknown>).code).toBe('invalid_json')
  })

  it('rejects invalid provider', async () => {
    const context = createMockContext(validBody({ provider: 'grok' }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    expect((json.error as Record<string, unknown>).message).toContain(
      'Invalid provider',
    )
  })

  it('rejects missing messages', async () => {
    const body = validBody()
    delete body.messages
    const context = createMockContext(body)
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(response.status).toBe(400)
  })

  it('rejects missing apiKey', async () => {
    const body = validBody()
    delete body.apiKey
    const context = createMockContext(body)
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(response.status).toBe(400)
  })
})

describe('provider routing', () => {
  it('routes claude to Anthropic', async () => {
    setupStreamTextSuccess()
    const context = createMockContext(validBody({ provider: 'claude' }))
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(mockCreateAnthropic).toHaveBeenCalledWith({
      apiKey: 'sk-test-key-123',
    })
  })

  it('routes chatgpt to OpenAI', async () => {
    setupStreamTextSuccess()
    const context = createMockContext(
      validBody({ provider: 'chatgpt', model: 'gpt-5.2' }),
    )
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      apiKey: 'sk-test-key-123',
    })
  })

  it('routes gemini to Google', async () => {
    setupStreamTextSuccess()
    const context = createMockContext(
      validBody({ provider: 'gemini', model: 'gemini-3-flash-preview' }),
    )
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(mockCreateGoogle).toHaveBeenCalledWith({
      apiKey: 'sk-test-key-123',
    })
  })
})

describe('successful streaming', () => {
  it('returns stream response with CORS headers', async () => {
    setupStreamTextSuccess('streamed content')
    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(await response.text()).toBe('streamed content')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

describe('error mapping', () => {
  it('maps auth error to 401', async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error('Invalid API key provided')
    })
    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(response.status).toBe(401)
    const json = await parseResponseBody(response)
    expect((json.error as Record<string, unknown>).code).toBe('invalid_api_key')
  })

  it('maps rate limit to 429', async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error('Rate limit exceeded')
    })
    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(response.status).toBe(429)
  })

  it('maps timeout to 504', async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error('Request timeout')
    })
    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(response.status).toBe(504)
  })

  it('maps provider outage to 502', async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error('Service unavailable')
    })
    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(response.status).toBe(502)
  })

  it('maps unknown error to 500', async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error('Something unexpected')
    })
    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(response.status).toBe(500)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

describe('providerOptions (thinking/reasoning)', () => {
  type StreamTextArgs = {
    model: unknown
    messages: unknown
    providerOptions?: Record<string, unknown>
  }

  /** Make a request for a given provider and return the args passed to streamText. */
  async function captureStreamTextArgs(
    provider: string,
    model: string,
  ): Promise<StreamTextArgs> {
    setupStreamTextSuccess()
    const context = createMockContext(validBody({ provider, model }))
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )
    expect(mockStreamText).toHaveBeenCalledTimes(1)
    return mockStreamText.mock.calls[0][0] as StreamTextArgs
  }

  it('passes anthropic adaptive thinking for claude provider', async () => {
    const args = await captureStreamTextArgs('claude', 'claude-sonnet-4-6')
    expect(args.providerOptions).toBeDefined()
    expect(args.providerOptions!.anthropic).toEqual({
      thinking: { type: 'adaptive' },
    })
  })

  it('passes openai reasoning effort for chatgpt provider', async () => {
    const args = await captureStreamTextArgs('chatgpt', 'gpt-5.2')
    expect(args.providerOptions).toBeDefined()
    expect(args.providerOptions!.openai).toEqual({
      reasoningEffort: 'high',
    })
  })

  it('passes google thinkingConfig for gemini provider', async () => {
    const args = await captureStreamTextArgs('gemini', 'gemini-3-flash-preview')
    expect(args.providerOptions).toBeDefined()
    expect(args.providerOptions!.google).toEqual({
      thinkingConfig: {
        thinkingLevel: 'high',
        includeThoughts: true,
      },
    })
  })

  it('always includes providerOptions for every supported provider', async () => {
    for (const [provider, model] of [
      ['claude', 'claude-sonnet-4-6'],
      ['chatgpt', 'gpt-5.2'],
      ['gemini', 'gemini-3-flash-preview'],
    ] as const) {
      vi.clearAllMocks()
      mockAnthropicModel.mockReturnValue('anthropic-model-instance')
      mockOpenAIModel.mockReturnValue('openai-model-instance')
      mockGoogleModel.mockReturnValue('google-model-instance')

      const args = await captureStreamTextArgs(provider, model)
      expect(
        args.providerOptions,
        `providerOptions missing for ${provider}`,
      ).toBeDefined()
    }
  })
})

describe('sendReasoning flag', () => {
  type UIStreamOptions = {
    sendReasoning?: boolean
    onError?: unknown
    messageMetadata?: unknown
  }

  /** Make a request and capture the options passed to toUIMessageStreamResponse. */
  async function captureUIStreamOptions(): Promise<UIStreamOptions> {
    let captured: UIStreamOptions | undefined
    const mockToUIStream = vi.fn((opts: UIStreamOptions) => {
      captured = opts
      return new Response('stream')
    })
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: mockToUIStream,
    })

    const context = createMockContext(validBody())
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(mockToUIStream).toHaveBeenCalledTimes(1)
    return captured!
  }

  it('passes sendReasoning: true to toUIMessageStreamResponse', async () => {
    const opts = await captureUIStreamOptions()
    expect(opts.sendReasoning).toBe(true)
  })

  it('includes messageMetadata alongside sendReasoning', async () => {
    const opts = await captureUIStreamOptions()
    expect(opts.sendReasoning).toBe(true)
    expect(opts.messageMetadata).toBeDefined()
    expect(typeof opts.messageMetadata).toBe('function')
  })

  it('includes onError alongside sendReasoning', async () => {
    const opts = await captureUIStreamOptions()
    expect(opts.sendReasoning).toBe(true)
    expect(opts.onError).toBeDefined()
    expect(typeof opts.onError).toBe('function')
  })
})

describe('messageMetadata callback', () => {
  type MetadataPart = { type: string; totalUsage?: Record<string, number> }
  type MetadataCallback = (opts: { part: MetadataPart }) => unknown

  /** Set up streamText mock and make a request, returning the captured messageMetadata callback. */
  async function captureMessageMetadata(): Promise<MetadataCallback> {
    let captured: MetadataCallback | undefined
    const mockToUIStream = vi.fn(
      (opts: { messageMetadata?: MetadataCallback }) => {
        captured = opts.messageMetadata
        return new Response('stream')
      },
    )
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: mockToUIStream,
    })

    const context = createMockContext(validBody())
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(captured).toBeDefined()
    return captured!
  }

  it('passes messageMetadata to toUIMessageStreamResponse', async () => {
    await captureMessageMetadata()
  })

  it('extracts token usage from finish part', async () => {
    const messageMetadata = await captureMessageMetadata()

    const result = messageMetadata({
      part: {
        type: 'finish',
        totalUsage: { inputTokens: 500, outputTokens: 1200 },
      },
    })
    expect(result).toEqual({
      usage: {
        inputTokens: 500,
        outputTokens: 1200,
      },
    })
  })

  it('returns undefined for non-finish parts', async () => {
    const messageMetadata = await captureMessageMetadata()

    expect(messageMetadata({ part: { type: 'text-delta' } })).toBeUndefined()
    expect(messageMetadata({ part: { type: 'step-start' } })).toBeUndefined()
  })

  it('handles zero token counts in finish part', async () => {
    const messageMetadata = await captureMessageMetadata()

    const result = messageMetadata({
      part: {
        type: 'finish',
        totalUsage: { inputTokens: 0, outputTokens: 0 },
      },
    })
    expect(result).toEqual({
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
    })
  })
})

describe('onError callback', () => {
  it('returns user-friendly message for known errors', async () => {
    let capturedOnError: ((err: unknown) => string) | undefined
    const mockToUIStream = vi.fn(
      (opts: { onError?: (err: unknown) => string }) => {
        capturedOnError = opts.onError
        return new Response('stream')
      },
    )
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: mockToUIStream,
    })

    const context = createMockContext(validBody({ provider: 'claude' }))
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(capturedOnError).toBeDefined()
    const message = capturedOnError!(new Error('Invalid API key'))
    expect(message).toContain('claude')
  })
})
