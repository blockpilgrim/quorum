/**
 * Cloudflare Pages Function: POST /api/chat
 *
 * Stateless proxy that forwards chat requests to AI providers (Anthropic,
 * OpenAI, Google) using the Vercel AI SDK. Streams responses back to the
 * SPA with CORS headers.
 *
 * Request body: { provider, model, messages, apiKey }
 * Response: UI message stream (SSE) compatible with @ai-sdk/react useChat
 */

import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Provider = 'claude' | 'chatgpt' | 'gemini'

interface ChatRequestBody {
  provider: Provider
  model: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  apiKey: string
}

interface ProxyErrorResponse {
  error: {
    code: string
    message: string
    provider?: Provider
  }
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

function corsResponse(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

/**
 * Maps provider/SDK errors to a consistent JSON error shape with an
 * appropriate HTTP status code.
 */
function mapError(
  err: unknown,
  provider?: Provider,
): { status: number; body: ProxyErrorResponse } {
  const message =
    err instanceof Error ? err.message : 'An unexpected error occurred'

  // Detect common error categories from provider error messages
  const messageLower = message.toLowerCase()

  if (
    messageLower.includes('api key') ||
    messageLower.includes('authentication') ||
    messageLower.includes('unauthorized') ||
    messageLower.includes('invalid x-api-key') ||
    messageLower.includes('incorrect api key')
  ) {
    return {
      status: 401,
      body: {
        error: {
          code: 'invalid_api_key',
          message: `Invalid API key for ${provider ?? 'provider'}. Please check your key and try again.`,
          provider,
        },
      },
    }
  }

  if (
    messageLower.includes('rate limit') ||
    messageLower.includes('too many requests') ||
    messageLower.includes('quota')
  ) {
    return {
      status: 429,
      body: {
        error: {
          code: 'rate_limited',
          message: `Rate limit exceeded for ${provider ?? 'provider'}. Please wait and try again.`,
          provider,
        },
      },
    }
  }

  if (
    messageLower.includes('timeout') ||
    messageLower.includes('timed out') ||
    messageLower.includes('deadline')
  ) {
    return {
      status: 504,
      body: {
        error: {
          code: 'timeout',
          message: `Request to ${provider ?? 'provider'} timed out. Please try again.`,
          provider,
        },
      },
    }
  }

  if (
    messageLower.includes('overloaded') ||
    messageLower.includes('service unavailable') ||
    messageLower.includes('internal server error') ||
    messageLower.includes('bad gateway')
  ) {
    return {
      status: 502,
      body: {
        error: {
          code: 'provider_error',
          message: `${provider ?? 'Provider'} is currently unavailable. Please try again later.`,
          provider,
        },
      },
    }
  }

  if (messageLower.includes('not found') || messageLower.includes('model')) {
    return {
      status: 400,
      body: {
        error: {
          code: 'invalid_model',
          message: `Model not found or not available for ${provider ?? 'provider'}. ${message}`,
          provider,
        },
      },
    }
  }

  // Fallback: unknown error
  return {
    status: 500,
    body: {
      error: {
        code: 'internal_error',
        message,
        provider,
      },
    },
  }
}

function errorResponse(status: number, body: ProxyErrorResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  })
}

// ---------------------------------------------------------------------------
// Request Validation
// ---------------------------------------------------------------------------

const VALID_PROVIDERS: Provider[] = ['claude', 'chatgpt', 'gemini']

function validateRequestBody(
  body: unknown,
): { valid: true; data: ChatRequestBody } | { valid: false; error: string } {
  if (body === null || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' }
  }

  const obj = body as Record<string, unknown>

  if (
    typeof obj.provider !== 'string' ||
    !VALID_PROVIDERS.includes(obj.provider as Provider)
  ) {
    return {
      valid: false,
      error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}.`,
    }
  }

  if (typeof obj.model !== 'string' || obj.model.trim() === '') {
    return { valid: false, error: 'Model must be a non-empty string.' }
  }

  if (!Array.isArray(obj.messages) || obj.messages.length === 0) {
    return {
      valid: false,
      error: 'Messages must be a non-empty array.',
    }
  }

  for (let i = 0; i < obj.messages.length; i++) {
    const msg = obj.messages[i] as Record<string, unknown>
    if (msg.role !== 'user' && msg.role !== 'assistant') {
      return {
        valid: false,
        error: `Message at index ${i} has invalid role. Must be "user" or "assistant".`,
      }
    }
    if (typeof msg.content !== 'string') {
      return {
        valid: false,
        error: `Message at index ${i} must have string content.`,
      }
    }
  }

  if (typeof obj.apiKey !== 'string' || obj.apiKey.trim() === '') {
    return { valid: false, error: 'API key must be a non-empty string.' }
  }

  return { valid: true, data: obj as unknown as ChatRequestBody }
}

// ---------------------------------------------------------------------------
// Provider Model Creation
// ---------------------------------------------------------------------------

/**
 * Creates a provider-specific language model instance using the AI SDK
 * provider adapters. Each call creates a fresh provider instance with
 * the user-supplied API key (BYOK pattern).
 */
function createModel(provider: Provider, model: string, apiKey: string) {
  switch (provider) {
    case 'claude': {
      const anthropic = createAnthropic({ apiKey })
      return anthropic(model)
    }
    case 'chatgpt': {
      const openai = createOpenAI({ apiKey })
      return openai(model)
    }
    case 'gemini': {
      const google = createGoogleGenerativeAI({ apiKey })
      return google(model)
    }
  }
}

// ---------------------------------------------------------------------------
// Request Handlers
// ---------------------------------------------------------------------------

/**
 * Handle CORS preflight requests.
 */
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

/**
 * Handle POST /api/chat — the main proxy endpoint.
 *
 * Accepts { provider, model, messages, apiKey } and streams the AI
 * response back using the AI SDK's UI message stream format, which is
 * compatible with the useChat hook on the client.
 */
export const onRequestPost: PagesFunction = async (context) => {
  // Parse request body
  let body: unknown
  try {
    body = await context.request.json()
  } catch {
    return errorResponse(400, {
      error: {
        code: 'invalid_json',
        message: 'Request body must be valid JSON.',
      },
    })
  }

  // Validate
  const validation = validateRequestBody(body)
  if (!validation.valid) {
    return errorResponse(400, {
      error: {
        code: 'validation_error',
        message: validation.error,
      },
    })
  }

  const { provider, model, messages, apiKey } = validation.data

  try {
    // Create the provider-specific model instance
    const languageModel = createModel(provider, model, apiKey)

    // Stream the response using AI SDK
    const result = streamText({
      model: languageModel,
      messages,
    })

    // Return the stream as a UI message stream response (compatible with useChat).
    // The onError callback transforms provider errors into user-friendly messages
    // that are sent to the client via the stream protocol.
    const streamResponse = result.toUIMessageStreamResponse({
      onError: (err) => {
        const { body } = mapError(err, provider)
        return body.error.message
      },
    })

    // Add CORS headers to the streaming response
    return corsResponse(streamResponse)
  } catch (err) {
    const { status, body: errorBody } = mapError(err, provider)
    return errorResponse(status, errorBody)
  }
}
