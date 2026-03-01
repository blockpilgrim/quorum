# Cortex

A tri-model AI workspace that sends your prompt to Claude, ChatGPT, and Gemini simultaneously and streams all three responses in real time.

## What It Does

Cortex eliminates the tab-switching workflow of comparing AI models. Type a message once, and it fans out to three providers concurrently — each maintaining its own independent conversation history. Three columns stream tokens side-by-side, so you can watch how Claude, ChatGPT, and Gemini approach the same question differently.

The interesting part is **cross-feed**: a single button press takes each model's latest response and shares it with the other two, triggering a second round of concurrent responses. The models effectively review each other's work. You can repeat this for as many rounds as you want — useful for iterative reasoning, code review, or getting models to challenge each other's assumptions.

Everything runs client-side with a bring-your-own-key model. API keys stay in your browser's IndexedDB. A thin Cloudflare Worker proxy (~150 lines) exists solely because OpenAI and Gemini don't support browser CORS — it forwards requests and streams responses, storing nothing.

## Tech Stack

- **Frontend:** React 19 + TypeScript, built with Vite 7
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **AI Streaming:** Vercel AI SDK — three independent `useChat` instances, one per provider, with adaptive thinking/reasoning enabled for all models
- **Providers:** Claude (Sonnet/Opus 4.6) via `@ai-sdk/anthropic`, GPT-5.2/5.3 Codex via `@ai-sdk/openai`, Gemini 3.1 Pro via `@openrouter/ai-sdk-provider`
- **Persistence:** Dexie.js v4 (IndexedDB) — conversations, messages, and API keys stored locally with reactive queries via `useLiveQuery`
- **State:** Zustand v5 for ephemeral UI state (streaming status, active conversation, model selections)
- **Proxy:** Cloudflare Pages Functions — stateless CORS proxy using AI SDK's `streamText`
- **PWA:** Installable with offline app shell caching via `vite-plugin-pwa`
- **Testing:** Vitest + React Testing Library (405 tests), Playwright configured for E2E

## Architecture

```
Browser (SPA)
├── Shared InputBar ──→ sends to all 3 useChat instances concurrently
├── Claude Column ────→ independent message history + streaming
├── ChatGPT Column ──→ independent message history + streaming
├── Gemini Column ───→ independent message history + streaming
├── Zustand ─────────→ streaming status, UI state, model selections
└── Dexie/IndexedDB ─→ conversations, messages, settings, API keys
         │
         │ HTTPS (SSE streaming)
         ▼
Cloudflare Worker (stateless proxy)
├── Validates request body
├── Creates provider-specific AI SDK model with user's API key
├── Calls streamText() with provider-specific reasoning config
└── Streams response back with CORS headers
         │
         ▼
Anthropic API / OpenAI API / OpenRouter API (Gemini)
```

**Key design decisions:**

- **Stream isolation:** Each model column is `React.memo`-wrapped with its own `useChat` instance. Tokens arriving for one provider don't re-render the others.
- **Persistence on completion:** Messages write to IndexedDB when a stream finishes, not during. Avoids hundreds of writes/second across three concurrent streams.
- **Cross-feed is client-orchestrated:** The SPA reads latest responses, constructs context messages, and sends three concurrent requests. The proxy stays stateless.
- **Imperative refs for send orchestration:** Parent dispatches to columns via `forwardRef` + `useImperativeHandle`. Streaming status syncs back via Zustand store.
- **Token usage from API metadata:** Actual token counts extracted from provider responses via AI SDK's `messageMetadata` callback. No client-side tokenizer. Cost estimates calculated from a per-model pricing table.

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server (includes Vite proxy for /api/chat)
npm run dev

# Run tests
npm run test

# Production build
npm run build
```

You'll need API keys from at least one provider — enter them in the settings dialog (gear icon). Keys are stored in your browser's IndexedDB and sent to the proxy with each request.

For the proxy in production, deploy to Cloudflare Pages — `wrangler.toml` is preconfigured. The free tier (100K requests/day) is more than sufficient.

## Live Demo

**[cortex-25w.pages.dev](https://cortex-25w.pages.dev/)**

Bring your own API keys — enter them in the settings dialog (gear icon).

## Status

Feature-complete MVP. Deployed on Cloudflare Pages. 405 tests passing. Built over a focused sprint as a daily-driver tool for comparing AI model outputs.
