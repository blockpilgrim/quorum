/**
 * Tests for the Cloudflare Pages Function API proxy (POST /api/chat).
 *
 * Since validateRequestBody, mapError, and createModel are module-private,
 * all testing goes through the exported handlers: onRequestPost and
 * onRequestOptions. We mock the AI SDK to avoid real API calls.
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
  createGoogleGenerativeAI: (...args: unknown[]) =>
    mockCreateGoogle(...args),
}))

// ---------------------------------------------------------------------------
// Import the module under test (after mocks are declared)
// ---------------------------------------------------------------------------

import { onRequestPost, onRequestOptions } from './chat'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid request body. */
function validBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    provider: 'claude',
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: 'Hello' }],
    apiKey: 'sk-test-key-123',
    ...overrides,
  }
}

/** Create a mock EventContext that mimics the Cloudflare PagesFunction context. */
function createMockContext(body: unknown): { request: Request } {
  const request = new Request('https://example.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return { request }
}

/** Create a mock context with invalid (non-JSON) body. */
function createInvalidJsonContext(): { request: Request } {
  const request = new Request('https://example.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not valid json {{{',
  })

  return { request }
}

/** Parse the JSON body from a Response. */
async function parseResponseBody(
  response: Response,
): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>
}

/**
 * Set up streamText to return a mock result with toUIMessageStreamResponse.
 * Returns the mock response so tests can inspect it.
 */
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

  // Default: set up a successful streamText mock
  mockAnthropicModel.mockReturnValue('anthropic-model-instance')
  mockOpenAIModel.mockReturnValue('openai-model-instance')
  mockGoogleModel.mockReturnValue('google-model-instance')
})

// =========================================================================
// CORS Preflight (onRequestOptions)
// =========================================================================

describe('onRequestOptions (CORS preflight)', () => {
  it('returns 204 with no body', async () => {
    const response = await onRequestOptions({} as Parameters<typeof onRequestOptions>[0])
    expect(response.status).toBe(204)
    expect(response.body).toBeNull()
  })

  it('returns Access-Control-Allow-Origin header', async () => {
    const response = await onRequestOptions({} as Parameters<typeof onRequestOptions>[0])
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('returns Access-Control-Allow-Methods header', async () => {
    const response = await onRequestOptions({} as Parameters<typeof onRequestOptions>[0])
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'POST, OPTIONS',
    )
  })

  it('returns Access-Control-Allow-Headers header', async () => {
    const response = await onRequestOptions({} as Parameters<typeof onRequestOptions>[0])
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
      'Content-Type',
    )
  })

  it('returns Access-Control-Max-Age header', async () => {
    const response = await onRequestOptions({} as Parameters<typeof onRequestOptions>[0])
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400')
  })
})

// =========================================================================
// Invalid JSON
// =========================================================================

describe('onRequestPost — invalid JSON', () => {
  it('returns 400 with invalid_json code', async () => {
    const context = createInvalidJsonContext()
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)

    const body = await parseResponseBody(response)
    const error = body.error as Record<string, unknown>
    expect(error.code).toBe('invalid_json')
    expect(error.message).toBe('Request body must be valid JSON.')
  })

  it('includes CORS headers on error response', async () => {
    const context = createInvalidJsonContext()
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

// =========================================================================
// Request Validation (via onRequestPost)
// =========================================================================

describe('onRequestPost — validation: provider', () => {
  it('rejects missing provider', async () => {
    const body = validBody()
    delete body.provider
    const context = createMockContext(body)
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.code).toBe('validation_error')
    expect(error.message).toContain('Invalid provider')
  })

  it('rejects invalid provider string', async () => {
    const context = createMockContext(validBody({ provider: 'grok' }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('Invalid provider')
    expect(error.message).toContain('claude, chatgpt, gemini')
  })

  it('rejects non-string provider (number)', async () => {
    const context = createMockContext(validBody({ provider: 42 }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('Invalid provider')
  })

  it.each(['claude', 'chatgpt', 'gemini'])(
    'accepts valid provider "%s"',
    async (provider) => {
      setupStreamTextSuccess()
      const context = createMockContext(validBody({ provider }))
      const response = await onRequestPost(
        context as unknown as Parameters<typeof onRequestPost>[0],
      )

      // Should not be a 400 validation error
      expect(response.status).not.toBe(400)
    },
  )
})

describe('onRequestPost — validation: model', () => {
  it('rejects missing model', async () => {
    const body = validBody()
    delete body.model
    const context = createMockContext(body)
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('Model must be a non-empty string')
  })

  it('rejects empty string model', async () => {
    const context = createMockContext(validBody({ model: '' }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('Model must be a non-empty string')
  })

  it('rejects whitespace-only model', async () => {
    const context = createMockContext(validBody({ model: '   ' }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('Model must be a non-empty string')
  })

  it('rejects non-string model', async () => {
    const context = createMockContext(validBody({ model: 123 }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
  })
})

describe('onRequestPost — validation: messages', () => {
  it('rejects missing messages', async () => {
    const body = validBody()
    delete body.messages
    const context = createMockContext(body)
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('Messages must be a non-empty array')
  })

  it('rejects empty messages array', async () => {
    const context = createMockContext(validBody({ messages: [] }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('Messages must be a non-empty array')
  })

  it('rejects non-array messages', async () => {
    const context = createMockContext(validBody({ messages: 'hello' }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('Messages must be a non-empty array')
  })

  it('rejects message with invalid role', async () => {
    const context = createMockContext(
      validBody({
        messages: [{ role: 'system', content: 'You are helpful' }],
      }),
    )
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('index 0')
    expect(error.message).toContain('invalid role')
  })

  it('rejects message with non-string content', async () => {
    const context = createMockContext(
      validBody({
        messages: [{ role: 'user', content: 42 }],
      }),
    )
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('index 0')
    expect(error.message).toContain('string content')
  })

  it('rejects message with missing content', async () => {
    const context = createMockContext(
      validBody({
        messages: [{ role: 'user' }],
      }),
    )
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('string content')
  })

  it('reports the correct index for invalid message in the middle', async () => {
    const context = createMockContext(
      validBody({
        messages: [
          { role: 'user', content: 'First' },
          { role: 'assistant', content: 'Reply' },
          { role: 'invalid', content: 'Bad role' },
        ],
      }),
    )
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('index 2')
  })

  it('accepts valid multi-turn conversation', async () => {
    setupStreamTextSuccess()
    const context = createMockContext(
      validBody({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
      }),
    )
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).not.toBe(400)
  })
})

describe('onRequestPost — validation: apiKey', () => {
  it('rejects missing apiKey', async () => {
    const body = validBody()
    delete body.apiKey
    const context = createMockContext(body)
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('API key must be a non-empty string')
  })

  it('rejects empty string apiKey', async () => {
    const context = createMockContext(validBody({ apiKey: '' }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('API key must be a non-empty string')
  })

  it('rejects whitespace-only apiKey', async () => {
    const context = createMockContext(validBody({ apiKey: '   ' }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
  })

  it('rejects non-string apiKey', async () => {
    const context = createMockContext(validBody({ apiKey: 12345 }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
  })
})

describe('onRequestPost — validation: body shape', () => {
  it('rejects null body', async () => {
    const context = createMockContext(null)
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('Request body must be a JSON object')
  })

  it('rejects array body', async () => {
    // Arrays are typeof 'object' but should still fail validation
    const request = new Request('https://example.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([1, 2, 3]),
    })
    const context = { request }
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
  })

  it('rejects string body (parsed as JSON string)', async () => {
    // JSON.parse('"hello"') => "hello" (a string, not an object)
    const request = new Request('https://example.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '"hello"',
    })
    const context = { request }
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.message).toContain('Request body must be a JSON object')
  })
})

// =========================================================================
// Provider Model Creation (via onRequestPost)
// =========================================================================

describe('onRequestPost — provider routing', () => {
  it('creates Anthropic model for claude provider', async () => {
    setupStreamTextSuccess()
    const context = createMockContext(
      validBody({ provider: 'claude', model: 'claude-sonnet-4-20250514' }),
    )
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(mockCreateAnthropic).toHaveBeenCalledWith({
      apiKey: 'sk-test-key-123',
    })
    expect(mockAnthropicModel).toHaveBeenCalledWith('claude-sonnet-4-20250514')
  })

  it('creates OpenAI model for chatgpt provider', async () => {
    setupStreamTextSuccess()
    const context = createMockContext(
      validBody({ provider: 'chatgpt', model: 'gpt-4o' }),
    )
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      apiKey: 'sk-test-key-123',
    })
    expect(mockOpenAIModel).toHaveBeenCalledWith('gpt-4o')
  })

  it('creates Google model for gemini provider', async () => {
    setupStreamTextSuccess()
    const context = createMockContext(
      validBody({ provider: 'gemini', model: 'gemini-2.0-flash' }),
    )
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(mockCreateGoogle).toHaveBeenCalledWith({
      apiKey: 'sk-test-key-123',
    })
    expect(mockGoogleModel).toHaveBeenCalledWith('gemini-2.0-flash')
  })

  it('passes messages to streamText', async () => {
    setupStreamTextSuccess()
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'How are you?' },
    ]
    const context = createMockContext(validBody({ messages }))
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages,
      }),
    )
  })
})

// =========================================================================
// Successful Streaming Response
// =========================================================================

describe('onRequestPost — successful streaming', () => {
  it('returns the stream response from toUIMessageStreamResponse', async () => {
    setupStreamTextSuccess('streamed content')
    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    // The response body should match what toUIMessageStreamResponse returned
    const text = await response.text()
    expect(text).toBe('streamed content')
  })

  it('adds CORS headers to the streaming response', async () => {
    setupStreamTextSuccess()
    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'POST, OPTIONS',
    )
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
      'Content-Type',
    )
  })

  it('calls streamText with the model instance', async () => {
    mockAnthropicModel.mockReturnValue('my-claude-model')
    setupStreamTextSuccess()

    const context = createMockContext(validBody({ provider: 'claude' }))
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'my-claude-model',
      }),
    )
  })

  it('passes onError to toUIMessageStreamResponse', async () => {
    const mockToUIStream = vi.fn(() => new Response('ok'))
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: mockToUIStream,
    })

    const context = createMockContext(validBody())
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(mockToUIStream).toHaveBeenCalledWith(
      expect.objectContaining({
        onError: expect.any(Function),
      }),
    )
  })
})

// =========================================================================
// Error Mapping (via onRequestPost — synchronous errors from createModel/streamText)
// =========================================================================

describe('onRequestPost — error mapping: authentication errors', () => {
  it.each([
    'Invalid API key provided',
    'Authentication failed',
    'Unauthorized access',
    'Invalid x-api-key header',
    'Incorrect API key',
  ])('maps "%s" to 401 invalid_api_key', async (errorMessage) => {
    mockStreamText.mockImplementation(() => {
      throw new Error(errorMessage)
    })

    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(401)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.code).toBe('invalid_api_key')
    expect(error.provider).toBe('claude')
  })
})

describe('onRequestPost — error mapping: rate limiting', () => {
  it.each([
    'Rate limit exceeded',
    'Too many requests',
    'Quota exceeded for this billing period',
  ])('maps "%s" to 429 rate_limited', async (errorMessage) => {
    mockStreamText.mockImplementation(() => {
      throw new Error(errorMessage)
    })

    const context = createMockContext(validBody({ provider: 'chatgpt' }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(429)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.code).toBe('rate_limited')
    expect(error.provider).toBe('chatgpt')
  })
})

describe('onRequestPost — error mapping: timeout', () => {
  it.each([
    'Request timeout',
    'Connection timed out',
    'Deadline exceeded',
  ])('maps "%s" to 504 timeout', async (errorMessage) => {
    mockStreamText.mockImplementation(() => {
      throw new Error(errorMessage)
    })

    const context = createMockContext(validBody({ provider: 'gemini' }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(504)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.code).toBe('timeout')
    expect(error.provider).toBe('gemini')
  })
})

describe('onRequestPost — error mapping: provider outage', () => {
  it.each([
    'Server overloaded',
    'Service unavailable',
    'Internal server error from provider',
    'Bad gateway received',
  ])('maps "%s" to 502 provider_error', async (errorMessage) => {
    mockStreamText.mockImplementation(() => {
      throw new Error(errorMessage)
    })

    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(502)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.code).toBe('provider_error')
  })
})

describe('onRequestPost — error mapping: model not found', () => {
  it.each([
    'Model not found: gpt-5',
    'The model does not exist',
    'Model not available in this region',
  ])('maps "%s" to 400 invalid_model', async (errorMessage) => {
    mockStreamText.mockImplementation(() => {
      throw new Error(errorMessage)
    })

    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(400)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.code).toBe('invalid_model')
  })
})

describe('onRequestPost — error mapping: unknown errors', () => {
  it('maps unknown error message to 500 internal_error', async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error('Something completely unexpected happened')
    })

    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(500)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.code).toBe('internal_error')
    expect(error.message).toBe('Something completely unexpected happened')
  })

  it('maps non-Error throw to 500 with default message', async () => {
    mockStreamText.mockImplementation(() => {
      throw 'string error'
    })

    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.status).toBe(500)
    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.code).toBe('internal_error')
    expect(error.message).toBe('An unexpected error occurred')
  })

  it('includes provider in error response', async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error('Unknown problem')
    })

    const context = createMockContext(validBody({ provider: 'gemini' }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    const json = await parseResponseBody(response)
    const error = json.error as Record<string, unknown>
    expect(error.provider).toBe('gemini')
  })
})

describe('onRequestPost — error responses have CORS headers', () => {
  it('includes CORS headers on auth error', async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error('Invalid API key')
    })

    const context = createMockContext(validBody())
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'POST, OPTIONS',
    )
  })

  it('includes CORS headers on validation error', async () => {
    const context = createMockContext(validBody({ provider: 'invalid' }))
    const response = await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

// =========================================================================
// onError callback in toUIMessageStreamResponse
// =========================================================================

describe('onRequestPost — onError callback in stream', () => {
  it('returns user-friendly message for auth errors via onError', async () => {
    let capturedOnError: ((err: unknown) => string) | undefined
    const mockToUIStream = vi.fn((opts: { onError?: (err: unknown) => string }) => {
      capturedOnError = opts.onError
      return new Response('stream')
    })
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: mockToUIStream,
    })

    const context = createMockContext(validBody({ provider: 'claude' }))
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    expect(capturedOnError).toBeDefined()
    const message = capturedOnError!(new Error('Invalid API key'))
    expect(message).toContain('Invalid API key')
    expect(message).toContain('claude')
  })

  it('returns user-friendly message for rate limit errors via onError', async () => {
    let capturedOnError: ((err: unknown) => string) | undefined
    const mockToUIStream = vi.fn((opts: { onError?: (err: unknown) => string }) => {
      capturedOnError = opts.onError
      return new Response('stream')
    })
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: mockToUIStream,
    })

    const context = createMockContext(validBody({ provider: 'chatgpt' }))
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    const message = capturedOnError!(new Error('Rate limit exceeded'))
    expect(message).toContain('Rate limit')
    expect(message).toContain('chatgpt')
  })

  it('returns raw message for unknown errors via onError', async () => {
    let capturedOnError: ((err: unknown) => string) | undefined
    const mockToUIStream = vi.fn((opts: { onError?: (err: unknown) => string }) => {
      capturedOnError = opts.onError
      return new Response('stream')
    })
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: mockToUIStream,
    })

    const context = createMockContext(validBody())
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    const message = capturedOnError!(new Error('Something weird'))
    expect(message).toBe('Something weird')
  })

  it('handles non-Error objects in onError', async () => {
    let capturedOnError: ((err: unknown) => string) | undefined
    const mockToUIStream = vi.fn((opts: { onError?: (err: unknown) => string }) => {
      capturedOnError = opts.onError
      return new Response('stream')
    })
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: mockToUIStream,
    })

    const context = createMockContext(validBody())
    await onRequestPost(
      context as unknown as Parameters<typeof onRequestPost>[0],
    )

    const message = capturedOnError!('not an error object')
    expect(message).toBe('An unexpected error occurred')
  })
})
