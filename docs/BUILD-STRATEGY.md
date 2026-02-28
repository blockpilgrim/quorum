# Build Strategy: Cortex — Unified Tri-Model AI Workspace

## Guiding Constraints

- **Build fast and cheap** without taking shortcuts
- **Portfolio piece** — demonstrate modern tooling, clean architecture, and good engineering judgment
- **Single-user tool** — no multi-tenancy, no auth, no enterprise concerns

---

## Tech Stack

### Frontend: Vite + React + TypeScript

**Decision**: Vite 7 with React 19 and TypeScript. Not Next.js, not SvelteKit.

**Rationale**: This is a client-side SPA. There is no SEO requirement, no server-side rendering, no static site generation. Next.js's strengths (App Router, Server Components, ISR) are entirely wasted here — you'd be fighting its opinionated full-stack architecture to build something it wasn't designed for. Vite is purpose-built for SPAs: sub-2-second cold starts, millisecond HMR, and a minimal output bundle with zero unnecessary framework overhead.

**Trade-off**: SvelteKit would produce a smaller bundle (1.6 KB runtime vs React's ~42 KB) with arguably better DX, but the React ecosystem has overwhelming advantages for this project — the Vercel AI SDK, shadcn/ui, and nearly every AI chat example and tutorial are React-first. For a portfolio piece, React also carries stronger hiring signal.

### AI Streaming: Vercel AI SDK

**Decision**: Use the `ai` package (AI SDK core) with `@ai-sdk/react` on the client and `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google` provider adapters on the server proxy.

**Rationale**: The AI SDK provides a unified interface across all three providers. The `useChat` hook handles streaming state, message accumulation, loading/error states, and abort — all things you'd otherwise build from scratch. There is a documented pattern for exactly this use case: [streaming multiple models in parallel with `useChat`](https://www.robinwieruch.de/react-ai-sdk-multiple-streams/). Each model column gets its own `useChat` instance, sharing the same user input but maintaining independent message histories.

**Trade-off**: The AI SDK has versioned aggressively (v3 → v4 → v5 → v6 in ~18 months). This means potential churn. Mitigate by pinning versions and treating the SDK as a convenience layer, not a deep dependency — keep business logic (persistence, cross-feed, export) independent of it. If the SDK ever becomes untenable, the fallback is custom `fetch` + `ReadableStream` hooks (~200 lines of code).

### Thin API Proxy: Cloudflare Workers (via Pages Functions)

**Decision**: Deploy a minimal Cloudflare Worker as the server-side layer that `useChat` communicates with.

**Rationale**: You cannot build this without some server-side component. Here's the CORS reality:

| Provider | Direct Browser Calls | CORS Support |
|----------|---------------------|--------------|
| Anthropic (Claude) | Yes | Explicit opt-in via header |
| OpenAI | Unreliable | Undocumented; has had multi-hour outages |
| Google (Gemini) | No | Not supported |

OpenAI does not officially document or guarantee CORS headers, and they've broken multiple times (Oct 2025, Jan 2026). Gemini flat-out blocks browser requests. Only Anthropic explicitly supports it. Building a "direct from browser" architecture means one provider works reliably, one works sometimes, and one doesn't work at all. That's not a foundation to build on.

A Cloudflare Worker solves this uniformly: it receives requests from the SPA, calls the AI provider APIs server-side (no CORS issue), and streams responses back with proper CORS headers. It's ~50 lines of code, deploys in minutes, and the free tier gives 100,000 requests/day — more than enough for single-user daily driving.

**Trade-off**: This is technically "a backend," despite the spec saying "no backend." But it's a stateless pass-through function, not an application server. It has no database, no sessions, no business logic. The alternative — hybrid direct-call for some providers and proxy for others — adds code path complexity for no real benefit.

### API Key Management: Bring Your Own Key (BYOK)

**Decision**: Users enter their own API keys in the UI. Keys are stored in the browser (IndexedDB). The SPA sends keys to the proxy with each request. The proxy forwards them to the provider, never stores them.

**Rationale**: This matches the spec ("API keys stored locally") and is the standard pattern for single-user AI tools. The proxy is a dumb pipe — it doesn't hold secrets. This means: no server-side secret management, no key rotation infra, no per-user auth.

**Trade-off**: API keys transit through the proxy. For a personal tool this is acceptable. For a public product, you'd want server-side key storage with authenticated sessions. To limit blast radius if a key leaks, users should set spending caps on their provider accounts.

### Persistent Storage: IndexedDB via Dexie.js

**Decision**: Dexie.js v4 wrapping IndexedDB for all persistent data (conversations, messages, settings).

**Rationale**: localStorage is capped at 5-10 MB (a single long conversation could exceed that) and its synchronous API blocks the UI thread during reads/writes. IndexedDB offers effectively unlimited storage, async operations, indexed queries, and transactional safety. Dexie provides a clean API on top of it plus `useLiveQuery` — a React hook that automatically re-renders components when the underlying data changes, even across browser tabs. This eliminates an entire class of sync bugs between storage and UI state.

**Trade-off**: More complexity than localStorage. Dexie adds ~25 KB gzipped to the bundle. Both are justified by the use case — a chat app generates a lot of data, and reactive queries are essential for the conversation sidebar.

### App State: Zustand

**Decision**: Zustand v5 for ephemeral application state (UI state, active conversation, theme preferences, model selections).

**Rationale**: Chat message state is handled by `useChat` instances (streaming) and Dexie (persistence). What remains is lightweight app-level state: which sidebar is open, which models are selected, which conversation is active. Zustand is the 2025 consensus for this — minimal boilerplate, no providers or context wrappers, works outside React components, and adds ~1 KB gzipped.

**Trade-off**: React Context would work fine for this small scope and avoids a dependency. Zustand wins on ergonomics (no provider nesting, no re-render cascades) and scales better if the app grows.

### Styling: Tailwind CSS + shadcn/ui

**Decision**: Tailwind CSS v4 for utility classes, shadcn/ui for component primitives, with a dark-mode-default theme.

**Rationale**: A three-column streaming chat layout with responsive mobile stacking is a CSS-intensive problem. Tailwind's grid/flexbox utilities make this layout trivial (`grid grid-cols-1 md:grid-cols-3`). shadcn/ui provides high-quality, accessible components (buttons, inputs, scroll areas, dialogs) as copy-paste code you own, not an installed dependency. There is also a `shadcn-chat` extension with purpose-built chat bubble, message list, and input components.

**Trade-off**: Tailwind produces verbose class names and requires familiarity with its utility system. The alternative — CSS Modules or styled-components — would be cleaner in JSX but slower to iterate with and harder to maintain responsive layouts. For a portfolio piece, Tailwind + shadcn signals modern frontend practice.

### Deployment: Cloudflare Pages

**Decision**: Deploy the SPA and Worker together on Cloudflare Pages.

**Rationale**: Cloudflare Pages hosts the static SPA assets with unlimited bandwidth (free), and co-located Pages Functions serve as the API proxy. One platform, one deploy command, zero infra management. The free tier (100K function requests/day, unlimited static bandwidth, 500 builds/month) is the most generous of the major platforms and sufficient for this use case.

**Trade-off**: Vercel has superior DX and preview deployments, but its free tier is more constrained (100 GB bandwidth cap, compute hour limits) and its edge function timeout behavior can be problematic for long AI streaming responses. Netlify is comparable but has less mature edge function support.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (SPA)                       │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Claude   │  │  ChatGPT │  │  Gemini  │  useChat ×3 │
│  │  Column   │  │  Column  │  │  Column  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│  ┌────┴──────────────┴──────────────┴────┐              │
│  │         Shared Input Bar              │              │
│  └───────────────┬───────────────────────┘              │
│                  │                                       │
│  ┌───────────────┴───────────────────────┐              │
│  │    Zustand (UI state, preferences)    │              │
│  └───────────────┬───────────────────────┘              │
│                  │                                       │
│  ┌───────────────┴───────────────────────┐              │
│  │    Dexie.js / IndexedDB               │              │
│  │    (conversations, messages, keys)    │              │
│  └───────────────────────────────────────┘              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS (streaming)
                       ▼
┌──────────────────────────────────────────────────────────┐
│              Cloudflare Pages Function                    │
│              (Stateless API Proxy)                        │
│                                                          │
│   Request in → add CORS headers → forward to provider    │
│   ← stream response back with CORS                      │
│                                                          │
│   Uses: @ai-sdk/anthropic, @ai-sdk/openai,              │
│         @ai-sdk/google, streamText                       │
└─────────┬──────────────┬──────────────┬─────────────────┘
          │              │              │
          ▼              ▼              ▼
     Anthropic API   OpenAI API   Google AI API
```

**Data flow for a user message:**
1. User types in the shared input bar
2. SPA sends the message to each model's `useChat` hook concurrently
3. Each `useChat` instance hits the Cloudflare proxy with: the message, conversation history, selected model, and API key
4. The proxy calls the appropriate provider using the AI SDK's `streamText`
5. Streaming tokens flow back through the proxy to each `useChat` instance
6. Each column renders tokens as they arrive
7. On stream completion, messages are persisted to IndexedDB via Dexie

**Data flow for cross-feed:**
1. User clicks "Cross-feed"
2. SPA reads the latest assistant message from each of the other two models
3. For each model, constructs a synthetic user message containing the other two responses
4. Sends these as concurrent requests through the same pipeline
5. Each model responds to the cross-fed context independently

---

## Data Architecture

### Core Models

**Conversation**
- `id` (auto-increment)
- `title` (auto-generated or user-set)
- `createdAt`, `updatedAt`
- `modelConfig` — which model variant is selected per provider for this conversation

**Message**
- `id` (auto-increment)
- `conversationId` (indexed)
- `provider` — `claude` | `chatgpt` | `gemini`
- `role` — `user` | `assistant`
- `content` — full text
- `timestamp` (indexed)
- `tokenCount` — input/output token counts from API response
- `isCrossFeed` — boolean flag for cross-feed messages
- `crossFeedRound` — which round (for grouping in UI)
- Compound index: `[conversationId+provider+timestamp]` for efficient per-thread queries

**Settings** (single record)
- `apiKeys` — per-provider, encrypted at rest if feasible
- `selectedModels` — per-provider model IDs
- `theme` — dark/light

### Relationships

```
Conversation 1 ──── * Message
                     (filtered by provider → 3 virtual threads)
```

There is no separate "Thread" entity. Each model's thread is a filtered view of Messages by `conversationId + provider`, ordered by `timestamp`. This keeps the schema flat and avoids sync issues between threads and conversations.

### Storage Estimates

- Average message: ~2 KB (content + metadata)
- 100 messages/day × 365 days = ~73 MB/year
- IndexedDB quota: typically 50%+ of available disk space
- No storage pressure concerns for single-user usage

---

## Key Decisions

### 1. Proxy Architecture: Unified vs. Hybrid

**Context**: Claude supports direct browser calls. OpenAI sometimes does. Gemini never does.

**Decision**: Route all three providers through the same Cloudflare Worker proxy.

**Rationale**: A unified proxy means one code path, one error handling strategy, one streaming implementation. The hybrid approach (direct for Claude, proxy for the rest) saves ~30ms of latency for Claude calls but doubles the client-side networking code, creates inconsistent error handling, and means debugging streaming issues requires checking two completely different paths.

**Trade-off**: Slightly higher latency for Claude (extra hop through the proxy). Irrelevant at the scale of AI response times (seconds, not milliseconds).

### 2. Message Persistence Strategy: Sync-on-Complete vs. Continuous

**Context**: `useChat` manages message state in memory during streaming. Messages also need to live in IndexedDB for persistence.

**Decision**: Persist messages to IndexedDB on stream completion, not during streaming. Load from IndexedDB on conversation open, then hand off to `useChat` for the active session.

**Rationale**: Writing every streaming token to IndexedDB would generate hundreds of writes per second across three streams — wasteful and potentially janky. Instead, the in-memory `useChat` state is the source of truth during an active session, and IndexedDB is the source of truth for historical conversations. Sync happens at two points: (1) when a stream completes (write), and (2) when a conversation is loaded (read).

**Trade-off**: If the browser crashes mid-stream, the partial response is lost. Acceptable for a chat tool — the user can regenerate. If this proves annoying, a simple mitigation is writing a checkpoint every N seconds during streaming.

### 3. Cross-Feed Implementation: Client-Orchestrated

**Context**: Cross-feed sends each model the other two models' latest responses. This could be orchestrated client-side or server-side.

**Decision**: Client-side orchestration. The SPA reads the latest responses, constructs the cross-feed messages, and sends three concurrent requests through the normal message pipeline.

**Rationale**: The proxy is stateless by design — it doesn't know about conversations, message history, or which models are in play. Keeping orchestration client-side means the proxy stays a dumb pipe, and all business logic lives in one place (the SPA). The cross-feed is just three normal messages sent concurrently with specific content.

**Trade-off**: The cross-feed payload is larger (includes full responses from two models as input to the third). This increases token costs. No real architectural alternative — this is inherent to the feature.

### 4. Token Counting: Hybrid Approach

**Context**: The spec requires displaying token usage and estimated cost.

**Decision**: Use actual token counts from API responses (authoritative). Supplement with client-side estimation via `js-tiktoken` for pre-send previews.

**Rationale**: All three providers return actual token usage in their API responses — this is the only reliable source for billing-accurate numbers. Client-side estimation (via `js-tiktoken` for OpenAI models, rough approximation for Claude/Gemini) is useful for giving users a sense of cost before they send a message, but it will never be exact because providers have different tokenizers and system prompt overhead.

**Trade-off**: `js-tiktoken` adds bundle size (~100 KB for encoding data). Worth it for the UX improvement of pre-send estimation. Load the encoding data lazily to avoid impacting initial page load.

### 5. PWA: Minimal Implementation

**Context**: The app is used daily on mobile browsers. PWA could improve the experience.

**Decision**: Implement basic PWA with `vite-plugin-pwa` — manifest for installability and a service worker for app shell caching. No push notifications, no background sync.

**Rationale**: The cost is a few hours of configuration for meaningful UX gains: install-to-homescreen for a full-screen mobile experience, instant loading on repeat visits (cached shell), and offline access to conversation history (stored in IndexedDB). iOS PWA limitations (no reliable push, possible storage eviction) mean we shouldn't depend on advanced features.

**Trade-off**: Service workers add a caching layer that can cause stale-content bugs if not configured carefully. Use a "stale-while-revalidate" strategy for the shell and always fetch API responses from network.

---

## Testing Philosophy

Testing should be proportional to risk. For a single-user tool, the highest-risk areas are:
1. **Data integrity** — messages must persist correctly and never silently drop
2. **Streaming reliability** — three concurrent streams must not interfere with each other
3. **Cross-feed correctness** — the right content must go to the right model

### Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit | Vitest | Pure logic: message formatting, token estimation, cost calculation, export serialization |
| Component | Vitest + React Testing Library | UI components in isolation: message bubbles, input bar, model selector |
| Integration | Vitest | Data flow: Dexie read/write, `useChat` ↔ IndexedDB sync, cross-feed message construction |
| E2E | Playwright | Full flows: send message across 3 models, cross-feed round, export, conversation switching |

### What Not to Test

- Styling and layout (visual regression testing is high-maintenance, low-value for a solo project)
- Third-party library internals (don't test that Dexie writes to IndexedDB correctly — test that your code uses Dexie correctly)
- The proxy in isolation (it's a pass-through; test it through E2E flows)

### Approach

Write tests as you build, not after. Focus on the logic layer and data flows. Use Playwright sparingly for the critical happy paths. Aim for confidence, not coverage metrics.

---

## Performance Considerations

### The Core Challenge: Three Concurrent Streams

When three AI models stream tokens simultaneously, each firing 20+ chunks per second, naive state management triggers 60+ React re-renders per second across the component tree. This causes jank, dropped frames, and a laggy input bar.

### Mitigations

**Stream isolation**: Each model column is its own component subtree wrapped in `React.memo`. Tokens arriving for Claude do not trigger re-renders in the ChatGPT or Gemini columns. The `useChat` hook per column already provides this isolation naturally.

**RAF buffering** (if needed): If `useChat`'s built-in batching proves insufficient, buffer incoming tokens in a `useRef` and flush to state via `requestAnimationFrame` — at most ~60 state updates per second regardless of token arrival rate. The AI SDK handles this internally for most cases.

**Virtual scrolling for long conversations**: Once a conversation exceeds ~100 messages, rendering every message DOM node becomes expensive. Use `@virtuoso.dev/message-list` (purpose-built for chat) or TanStack Virtual to virtualize the message list. This is a "when needed" optimization — don't add it upfront if conversations are typically short.

**Lazy markdown rendering**: If responses contain complex markdown (code blocks, tables, math), parse and render markdown lazily with `useMemo` keyed on message content. Don't re-parse on every render.

### Bundle Size

- Target initial JS bundle < 200 KB gzipped
- Lazy-load: tiktoken encoding data, export logic, settings panel
- Code-split by route if/when routing is added

### Network

- Streaming means time-to-first-token matters more than total response time
- The proxy adds one network hop (~10-30ms) — negligible against model inference time
- Consider request deduplication: if the user double-clicks send, don't fire 6 requests

---

## What We're Optimizing For

1. **Speed of development** — Vite, AI SDK, shadcn/ui, and Dexie all minimize boilerplate and let you focus on product logic
2. **Reliability** — Unified proxy eliminates CORS fragility; isolated streams mean one provider failure doesn't cascade
3. **Portfolio signal** — React + TypeScript + modern tooling (Vite, AI SDK, Tailwind, Cloudflare) demonstrates current-generation engineering practice
4. **Operational simplicity** — One platform (Cloudflare), one deploy target, zero infra to manage, free tier covers everything

## What We're Sacrificing

1. **Absolute minimum latency** — The proxy adds a hop. Direct browser calls to Claude would be ~20ms faster. Not worth the architectural complexity.
2. **Zero backend** — The spec envisioned a purely client-side app. Reality (CORS) requires a thin proxy. It's stateless and free, so the spirit of the constraint is preserved.
3. **Framework independence** — Heavy investment in the Vercel AI SDK. If it makes breaking changes, migration work is required. Mitigated by keeping business logic separate from SDK-managed state.
4. **Bundle minimalism** — React + Tailwind + AI SDK + Dexie + tiktoken is not a tiny bundle. Acceptable for a power-user tool where the first load is a one-time cost and subsequent loads are instant (PWA caching).
