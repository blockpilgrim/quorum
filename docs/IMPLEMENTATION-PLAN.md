# Implementation Plan: Cortex MVP

Each phase produces a working, testable increment. Phases are sequential — later phases depend on earlier ones. Within a phase, tasks can often be parallelized.

---

- [x] ## Phase 1: Project Scaffold & Dev Environment

**Goal**: Empty app runs locally with all tooling configured.

1. **Initialize Vite + React + TypeScript project**
   - `npm create vite@latest` with React TS template
   - Verify dev server starts and HMR works

2. **Install and configure Tailwind CSS v4**
   - Set up Tailwind with Vite plugin
   - Configure dark mode as default
   - Verify utility classes render correctly

3. **Install shadcn/ui**
   - Initialize shadcn/ui with the project
   - Add base components: Button, Input, ScrollArea, Dialog, Sheet
   - Set up dark theme tokens

4. **Configure testing stack**
   - Vitest for unit/component/integration tests
   - React Testing Library
   - Playwright for E2E (config only, no tests yet)

5. **Set up linting and formatting**
   - ESLint with TypeScript rules
   - Prettier
   - Verify lint + format scripts work

**Exit criteria**: `npm run dev` shows a styled placeholder page. `npm run test` runs (with zero tests). `npm run build` produces a production bundle.

---

- [x] ## Phase 2: Data Layer

**Goal**: Conversations and messages can be created, read, and queried from IndexedDB. No UI beyond a dev-mode test harness if needed.

1. **Install Dexie.js v4**

2. **Define database schema**
   - `conversations` table: `id`, `title`, `createdAt`, `updatedAt`, `modelConfig`
   - `messages` table: `id`, `conversationId`, `provider`, `role`, `content`, `timestamp`, `tokenCount`, `isCrossFeed`, `crossFeedRound`
   - `settings` table: `id`, `apiKeys`, `selectedModels`, `theme`
   - Compound index on messages: `[conversationId+provider+timestamp]`

3. **Build data access functions**
   - `createConversation()`, `getConversation()`, `listConversations()`, `updateConversation()`, `deleteConversation()`
   - `addMessage()`, `getMessagesByThread()` (by conversationId + provider), `getMessagesByConversation()`
   - `getSettings()`, `updateSettings()`

4. **Write unit tests for the data layer**
   - CRUD operations on conversations and messages
   - Compound index queries return correct thread ordering
   - Settings read/write round-trips

**Exit criteria**: All data access functions have passing tests. Schema handles the full message model from BUILD-STRATEGY.md.

---

- [x] ## Phase 3: App Shell & Layout

**Goal**: The three-column (desktop) / stacked (mobile) layout renders with placeholder content. Navigation between conversations works.

1. **Set up Zustand store**
   - `activeConversationId`
   - `sidebarOpen`
   - `selectedModels` (per-provider)
   - `theme`

2. **Build the app shell layout**
   - Top bar with app title, new conversation button, sidebar toggle
   - Conversation sidebar (list of past conversations, new conversation action)
   - Main content area: 3-column grid on desktop, single-column stack on mobile
   - Shared input bar pinned to bottom

3. **Build the conversation sidebar**
   - List conversations from Dexie using `useLiveQuery`
   - Click to switch active conversation (updates Zustand)
   - "New conversation" clears active state
   - Responsive: full sidebar on desktop, Sheet overlay on mobile

4. **Build placeholder model columns**
   - Three columns labeled Claude, ChatGPT, Gemini
   - Each renders messages from its thread (filtered by provider)
   - Empty state when no messages exist

5. **Build the shared input bar**
   - Text input + send button
   - Disabled state when no API keys configured or while streaming
   - Auto-focus on load and after send

**Exit criteria**: Layout is responsive. Sidebar lists conversations from IndexedDB. Clicking a conversation loads its messages into the three columns. Input bar is visible and interactive (doesn't send yet).

---

- [x] ## Phase 4: API Proxy (Cloudflare Worker)

**Goal**: A deployed Cloudflare Pages Function that accepts a request with a model provider, API key, and message history, then streams the response back.

1. **Set up Cloudflare Pages project**
   - Configure `functions/` directory for Pages Functions
   - Set up local dev with `wrangler pages dev`

2. **Build the proxy endpoint**
   - Single route: `POST /api/chat`
   - Accept body: `{ provider, model, messages, apiKey }`
   - Use AI SDK's `streamText` with the appropriate provider adapter (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`)
   - Stream response back with proper CORS headers
   - Return token usage metadata in the stream

3. **Implement error handling**
   - Map provider-specific errors to consistent error shapes
   - Handle: invalid API key, rate limit, network timeout, provider outage
   - Return structured error JSON with status codes

4. **Test locally with curl / httpie**
   - Verify streaming works for all three providers
   - Verify error responses are well-formed
   - Verify CORS headers are present

**Exit criteria**: `wrangler pages dev` serves the proxy. Streaming requests to all three providers work via curl. Errors return structured JSON.

---

- [x] ## Phase 5: Streaming Chat — Single Provider

**Goal**: User can type a message and see a streaming response from one provider (start with Claude). Messages persist across reloads.

1. **Install AI SDK packages**
   - `ai`, `@ai-sdk/react`

2. **Integrate `useChat` for one column (Claude)**
   - Configure `useChat` to hit the proxy endpoint
   - Pass API key and model selection from Zustand/Dexie settings
   - Render streaming tokens in the Claude column

3. **Build the message bubble component**
   - Distinct styling for user vs. assistant messages
   - Markdown rendering for assistant responses (use `react-markdown` + `remark-gfm`)
   - Copy-to-clipboard button on assistant messages
   - Timestamp display

4. **Implement persistence sync**
   - On stream completion: write the full assistant message to Dexie
   - On send: write the user message to Dexie
   - On conversation load: read messages from Dexie, seed `useChat` initial messages

5. **Handle loading and error states**
   - Streaming indicator per column
   - Error display when provider fails
   - Retry action on error

6. **Write tests**
   - Unit: message formatting, markdown rendering edge cases
   - Integration: `useChat` ↔ Dexie sync (mock the streaming endpoint)

**Exit criteria**: User sends a message, sees streaming Claude response, reloads the page, and the conversation is still there. Errors display gracefully.

---

- [ ] ## Phase 6: Tri-Model Streaming

**Goal**: A single user message fans out to all three providers concurrently. Each column streams independently.

1. **Wire send to ChatGPT and Gemini columns**
   - All three `ModelColumn` instances with `useProviderChat` already render from Phase 5
   - Uncomment ChatGPT/Gemini `send()` calls in `App.tsx` `handleSend`
   - Each column's `useProviderChat` writes its own user message to Dexie per provider

2. **Verify stream isolation**
   - `React.memo` already wraps `ModelColumn` from Phase 5
   - Verify that tokens arriving for one provider don't re-render other columns
   - Profile with React DevTools if needed

4. **Implement model-level error isolation**
   - One provider failing does not block or affect the other two
   - Failed column shows error; others continue streaming

5. **Write tests**
   - Integration: three concurrent streams complete independently
   - Integration: one provider error doesn't affect others

**Exit criteria**: One message produces three independent streaming responses. A provider failure is isolated to its column. Performance is smooth with three concurrent streams.

---

- [ ] ## Phase 7: Settings & API Key Management

**Goal**: User can enter API keys and select models per provider. Settings persist.

1. **Build the settings panel**
   - Accessible from the top bar (gear icon)
   - Modal/dialog or slide-out panel
   - Three sections: Claude, ChatGPT, Gemini

2. **API key input per provider**
   - Masked input field
   - Save to Dexie settings table
   - Validation: test the key with a minimal API call on save (optional but nice)

3. **Model selector per provider**
   - Dropdown for each provider with available model variants
   - Claude: Opus, Sonnet, Haiku
   - OpenAI: GPT-4o, GPT-4o-mini, o1, o3-mini
   - Gemini: Pro, Flash
   - Selection persists to Dexie and Zustand

4. **Show selected model in each column header**

5. **First-run experience**
   - If no API keys are configured, prompt the user to enter them
   - Disable send until at least one key is configured

**Exit criteria**: User can set API keys and model choices. Settings survive reload. Selected models are visible in the column headers.

---

- [ ] ## Phase 8: Cross-Feed

**Goal**: User can trigger a cross-feed round that sends each model the other two models' latest responses.

1. **Build cross-feed orchestration logic**
   - Read the latest assistant message from each provider
   - For each provider, construct a user message containing the other two responses
   - Format clearly: label which response came from which model
   - Send all three concurrently through the normal `useChat` pipeline

2. **Add the cross-feed button**
   - Visible in the input bar area or as a separate action
   - Disabled when: no assistant responses exist yet, or streaming is in progress
   - Visual indicator that a cross-feed round is happening

3. **Mark cross-feed messages in storage**
   - Set `isCrossFeed: true` and `crossFeedRound` on cross-feed messages
   - Distinct visual styling for cross-feed messages in the UI

4. **Support multiple cross-feed rounds**
   - Each round increments the `crossFeedRound` counter
   - History accumulates naturally in each model's thread

5. **Write tests**
   - Unit: cross-feed message construction (correct content goes to correct model)
   - Integration: cross-feed round persists correctly with proper flags

**Exit criteria**: Cross-feed sends the right content to each model. Cross-feed messages are visually distinct. Multiple rounds work. Persistence is correct.

---

- [ ] ## Phase 9: Conversation Management

**Goal**: Full conversation lifecycle — create, switch, rename, delete.

1. **New conversation**
   - Clears all three `useChat` instances
   - Creates a new conversation record in Dexie
   - Updates Zustand active conversation

2. **Auto-title generation**
   - After the first response arrives, generate a title from the user's first message (truncate or summarize)

3. **Conversation switching**
   - Load messages from Dexie for the selected conversation
   - Seed each `useChat` instance with its provider's message thread
   - Restore model config from the conversation record

4. **Rename conversation**
   - Inline edit in the sidebar

5. **Delete conversation**
   - Confirmation dialog
   - Remove conversation and all its messages from Dexie

**Exit criteria**: User can create, switch between, rename, and delete conversations. Switching correctly restores each model's thread.

---

- [ ] ## Phase 10: Token Usage & Cost Display

**Goal**: User can see token counts and estimated costs.

1. **Capture token usage from API responses**
   - Extract input/output token counts from the stream metadata
   - Store in the `tokenCount` field on each message

2. **Build the usage display component**
   - Per-conversation summary: total tokens by provider, estimated cost
   - Per-message token count (subtle, non-intrusive)
   - Overall summary across all conversations

3. **Cost estimation logic**
   - Maintain a pricing table for supported models (hardcoded, updatable)
   - Calculate: `(input_tokens × input_price) + (output_tokens × output_price)`

4. **Write unit tests for cost calculation**

**Exit criteria**: Token counts are captured and displayed. Cost estimates are shown per-conversation and overall.

---

- [ ] ## Phase 11: Export

**Goal**: User can export conversations as JSON or Markdown files.

1. **Build JSON export**
   - Single conversation: full message history with metadata
   - All conversations: array of conversation objects with nested messages

2. **Build Markdown export** (optional but included)
   - Format messages as readable markdown with provider labels
   - Separate sections per model thread or interleaved by timestamp

3. **Trigger download**
   - Generate a Blob, create an object URL, trigger download
   - File naming: `cortex-{conversation-title}-{date}.json`

4. **Add export actions to the UI**
   - Export current conversation (from conversation menu or top bar)
   - Export all (from settings or sidebar)

5. **Write tests**
   - Unit: export serialization produces valid JSON/Markdown
   - Verify export never deletes local data

**Exit criteria**: Both single and bulk exports work. Files download correctly. Local data is untouched after export.

---

- [ ] ## Phase 12: Polish & PWA

**Goal**: Production-quality UX. Installable on mobile.

1. **PWA setup**
   - Install `vite-plugin-pwa`
   - Configure manifest (name, icons, theme color, display: standalone)
   - Service worker with stale-while-revalidate for app shell
   - Test install-to-homescreen on iOS and Android

2. **Responsive polish**
   - Test and fix layout on iPhone SE, standard iPhone, iPad, desktop
   - Ensure sidebar, input bar, and columns work at all breakpoints
   - Touch targets are appropriately sized on mobile

3. **Keyboard shortcuts**
   - `Enter` to send, `Shift+Enter` for newline
   - `Cmd/Ctrl+N` for new conversation
   - `Cmd/Ctrl+K` for quick conversation search (stretch)

4. **Loading states and transitions**
   - Skeleton loaders for conversation list
   - Smooth transitions when switching conversations
   - Request deduplication (prevent double-send)

5. **Accessibility pass**
   - Focus management for keyboard navigation
   - ARIA labels on interactive elements
   - Sufficient color contrast in dark mode

**Exit criteria**: App is installable as PWA. Mobile UX is smooth. No broken layouts at any viewport size.

---

- [ ] ## Phase 13: Deployment

**Goal**: App is live on Cloudflare Pages with the proxy function.

1. **Configure Cloudflare Pages deployment**
   - Connect repo (or use direct upload)
   - Build command: `npm run build`
   - Output directory: `dist`
   - Functions directory: `functions`

2. **Set up custom domain** (optional)

3. **Verify production deployment**
   - All three providers stream correctly through the deployed proxy
   - Conversations persist in the deployed environment
   - PWA install works from the deployed URL

4. **E2E tests against production** (smoke)
   - Send a message, verify three responses
   - Cross-feed round completes
   - Export downloads a file

**Exit criteria**: App is live, functional, and usable at the deployed URL.

---

## Dependency Graph

```
Phase 1  (Scaffold)
   │
   ├──→ Phase 2  (Data Layer)
   │       │
   │       ├──→ Phase 3  (App Shell & Layout)
   │       │       │
   │       │       └──→ Phase 5  (Single Provider Streaming) ←── Phase 4 (Proxy)
   │       │               │
   │       │               └──→ Phase 6  (Tri-Model Streaming)
   │       │                       │
   │       │                       ├──→ Phase 7  (Settings & Keys)
   │       │                       ├──→ Phase 8  (Cross-Feed)
   │       │                       └──→ Phase 9  (Conversation Mgmt)
   │       │                               │
   │       │                               ├──→ Phase 10 (Token Usage)
   │       │                               └──→ Phase 11 (Export)
   │       │                                       │
   │       │                                       └──→ Phase 12 (Polish & PWA)
   │       │                                               │
   │       │                                               └──→ Phase 13 (Deployment)
   │
   └──→ Phase 4  (Proxy) — can be built in parallel with Phases 2-3
```

Phases 4 and 2-3 are independent and can be worked on concurrently. Phases 7, 8, and 9 can be parallelized after Phase 6. Phases 10 and 11 can be parallelized after Phase 9.
