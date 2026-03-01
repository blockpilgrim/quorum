# Conventions

Patterns and anti-patterns for the Cortex codebase. Updated as the project evolves.

---

## Project Structure

**When to use**: Always. Follow this directory layout for all new code.

```
src/
  components/
    ui/          # shadcn/ui primitives (auto-generated, do not hand-edit)
  lib/           # Shared utilities and core modules
    db/          # Data layer (Dexie schema, types, data access functions)
    models.ts    # Model definitions, display names, provider constants
    store.ts     # Zustand store (ephemeral UI state)
    utils.ts     # Utility functions (cn(), helpers)
  hooks/         # Custom React hooks
  test/          # Test setup and shared test utilities
functions/       # Cloudflare Pages Functions (API proxy)
  api/
    chat.ts      # POST /api/chat — provider proxy endpoint
e2e/             # Playwright E2E tests
docs/            # Project documentation
```

**Why**: Matches the shadcn/ui convention and keeps generated code separate from application code.

---

## Import Aliases

**When to use**: Always use the `@/` alias for imports within `src/`.

**Example**:
```tsx
// Good
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Bad
import { Button } from '../../components/ui/button'
import { cn } from '../lib/utils'
```

**Why**: Path aliases eliminate fragile relative imports and make refactoring safer. Configured in both `tsconfig.app.json` and `vite.config.ts`.

---

## Dark Mode as Default

**When to use**: Always. The app ships with dark mode active.

**Example**:
```html
<!-- index.html -->
<html lang="en" class="dark">
  <body class="dark bg-background text-foreground">
```

**Why**: The product spec calls for dark-mode-default. The `class="dark"` on `<html>` activates the dark theme tokens defined in `src/index.css`. The Tailwind v4 `@custom-variant dark` directive scopes dark styles to `.dark *`.

---

## Tailwind CSS v4 Theme Tokens

**When to use**: Always use semantic color tokens from the theme, never raw color values.

**Example**:
```tsx
// Good - uses semantic tokens
<div className="bg-background text-foreground border-border" />
<div className="bg-card text-card-foreground" />
<div className="text-muted-foreground" />

// Bad - hardcoded colors
<div className="bg-gray-900 text-white border-gray-700" />
```

**Why**: Semantic tokens ensure consistent theming and make future light-mode support trivial. All tokens are defined in `src/index.css` under `@theme inline` (Tailwind v4) and `:root` / `.dark` blocks (shadcn/ui CSS variables).

---

## shadcn/ui Components

**When to use**: For all standard UI primitives (buttons, inputs, dialogs, etc.).

**Example**:
```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
```

**Why**: shadcn/ui components are copy-pasted source code we own (not an npm dependency). They use Radix UI primitives under the hood for accessibility. Do not modify files in `src/components/ui/` unless intentionally customizing a component.

---

## Testing Conventions

**When to use**: All test files.

- Test files live next to the code they test: `Component.tsx` -> `Component.test.tsx`
- Use the `.test.ts` or `.test.tsx` extension (not `.spec`)
- Vitest globals are enabled (`describe`, `it`, `expect` available without imports)
- React Testing Library is configured with jsdom environment
- Setup file at `src/test/setup.ts` loads jest-dom matchers

**Example**:
```tsx
import { render, screen } from '@testing-library/react'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

**Why**: Co-located tests are easier to find and maintain. Vitest globals reduce boilerplate.

---

## ESLint + Prettier

**When to use**: Always. Run before committing.

- ESLint handles code quality rules (TypeScript, React hooks, React refresh)
- Prettier handles formatting (no semicolons, single quotes, trailing commas)
- `eslint-config-prettier` disables ESLint rules that conflict with Prettier
- `prettier-plugin-tailwindcss` auto-sorts Tailwind class names

**Commands**:
```bash
npm run lint          # Check for lint errors
npm run format        # Auto-format all files
npm run format:check  # Check formatting without writing
```

---

## shadcn/ui Smoke Tests

**When to use**: When testing shadcn/ui primitives in `src/components/ui/`.

Place a single smoke-test file at `src/components/ui-components.test.tsx` (outside `ui/` directory). Don't co-locate test files inside `src/components/ui/` since that directory is for generated code.

**Why**: The `ui/` directory convention is "auto-generated, do not hand-edit." A single smoke-test suite one level up verifies that all primitives render without cluttering the generated directory.

---

## Dependency Categorization

**When to use**: When adding new npm packages.

- **`dependencies`**: Packages whose code/CSS is imported into `src/` files at runtime (React, Radix, clsx, tw-animate-css, etc.)
- **`devDependencies`**: Build-time, test-time, or lint-time only tools (Vite, Tailwind, Vitest, ESLint, Prettier, Playwright, shadcn CLI, etc.)

**Why**: Keeps the dependency manifest accurate even though Vite tree-shakes everything regardless.

---

## Data Layer (Dexie.js)

**When to use**: For all persistent data operations (conversations, messages, settings).

- Database schema is defined in `src/lib/db/schema.ts` as a singleton `db` instance
- TypeScript types for all tables live in `src/lib/db/types.ts`
- Data access functions are organized by table: `conversations.ts`, `messages.ts`, `settings.ts`
- Barrel export at `src/lib/db/index.ts` re-exports everything
- Import from `@/lib/db` for all data layer access

**Example**:
```ts
// Data access functions and types
import {
  createConversation,
  addMessage,
  getSettings,
  type Conversation,
  type Provider,
} from '@/lib/db'

// Direct db access (for useLiveQuery, advanced queries)
import { db } from '@/lib/db'
```

**Why**: Keeps the data layer modular and testable. The barrel export provides a clean public API while internal files can be refactored freely. Separating types from schema from access functions prevents circular dependencies.

### Data Access Function Conventions
- All functions are `async` (Dexie operations return Promises)
- Create functions accept `*Input` types and return the auto-generated `id`
- Timestamps (`createdAt`, `updatedAt`, `timestamp`) are set automatically by the access functions, not the caller
- `updateConversation` auto-bumps `updatedAt`
- `deleteConversation` cascades to messages using a Dexie transaction
- Settings is a singleton (always `id=1`); `getSettings()` auto-initializes on first run using `put` (upsert) to avoid race conditions
- `updateSettings()` shallow-merges nested objects (`apiKeys`, `selectedModels`) — callers can update a single provider key without overwriting others

---

## Zustand Store

**When to use**: For all ephemeral UI state (not persisted to IndexedDB).

- Store lives at `src/lib/store.ts`
- Split into `AppState` (data) and `AppActions` (setters) interfaces, composed as `AppStore = AppState & AppActions`
- Use selector-based access (one selector per field) to minimize re-renders
- Import from `@/lib/store`

**Example**:
```tsx
import { useAppStore } from '@/lib/store'

// Good — granular selectors, only re-renders when that field changes
const activeId = useAppStore((s) => s.activeConversationId)
const setActiveId = useAppStore((s) => s.setActiveConversationId)

// Bad — subscribes to entire store, re-renders on any change
const store = useAppStore()
```

**Testing**: Reset store in `beforeEach` to prevent state leakage between tests:
```ts
import { useAppStore } from '@/lib/store'

beforeEach(() => {
  useAppStore.setState({ activeConversationId: null, sidebarOpen: false })
})
```

**Why**: Zustand is lightweight (~1 KB), has no provider wrappers, and works outside React components. Granular selectors prevent cascading re-renders from streaming updates.

---

## Reactive Data with useLiveQuery

**When to use**: When a React component needs to reactively display data from Dexie (IndexedDB).

- Import `useLiveQuery` from `dexie-react-hooks`
- Always provide a dependency array as the second argument
- Handle the `undefined` return (loading state) before checking for empty data
- Prefer calling data access functions from `@/lib/db` inside the callback rather than raw Dexie queries
- When returning an empty array for a null/skipped query, cast it: `return [] as Message[]`

**Example**:
```tsx
import { useLiveQuery } from 'dexie-react-hooks'
import { getMessagesByThread } from '@/lib/db'
import type { Message } from '@/lib/db/types'

const messages = useLiveQuery(() => {
  if (activeConversationId === null) return [] as Message[]
  return getMessagesByThread(activeConversationId, provider)
}, [activeConversationId, provider])

// Handle loading vs empty
if (messages === undefined) return <Loading />
if (messages.length === 0) return <EmptyState />
```

**Why**: `useLiveQuery` automatically re-renders the component when the underlying Dexie data changes, even across browser tabs. Using data access functions inside the callback keeps query logic in the data layer while still enabling Dexie's reactive tracking.

---

## React.memo for Stream Isolation

**When to use**: Wrap model columns (and similar independently-updating components) in `React.memo`.

**Example**:
```tsx
import { memo } from 'react'

export const ModelColumn = memo(function ModelColumn({ provider, label }: Props) {
  // Component body
})
```

**Why**: When three AI models stream tokens simultaneously, each column receives high-frequency updates. `React.memo` prevents tokens arriving for one provider from re-rendering the other columns. Use a named function (not an arrow function) inside `memo()` for better debugging in React DevTools.

---

## Responsive Desktop/Mobile Pattern

**When to use**: When a component needs fundamentally different rendering on desktop vs mobile (not just layout changes).

- Render both variants simultaneously, use Tailwind responsive classes (`hidden md:block` / `md:hidden`) for visibility
- For interactive overlays (Sheet, Dialog), pass an `onAfterAction` callback only to the mobile variant so it can auto-close; the desktop variant stays open on interaction

**Example** (ConversationSidebar pattern):
```tsx
// Desktop: inline panel, stays open on interaction
{sidebarOpen && (
  <aside className="hidden w-64 border-r md:block">
    <SidebarContent onNewConversation={onNew} />
  </aside>
)}

// Mobile: Sheet overlay, closes on interaction
<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
  <SheetContent className="md:hidden">
    <SidebarContent onNewConversation={onNew} onAfterAction={closeSheet} />
  </SheetContent>
</Sheet>
```

**Why**: CSS-based visibility is simpler and more reliable than JS media query hooks. The `onAfterAction` pattern cleanly separates desktop (sidebar stays open) from mobile (overlay closes) behavior without conditional logic inside the shared content component.

---

## Testing with Radix Overlays (Sheet, Dialog)

**When to use**: When testing components that include Radix-based overlays (Sheet, Dialog).

- In jsdom, CSS media queries don't apply, so both desktop and mobile variants render simultaneously
- The Sheet's `aria-modal` overlay blocks `getByRole` queries for elements behind it
- **Fix for component isolation**: Set `sidebarOpen: false` in Zustand `beforeEach` when testing components that don't need the sidebar
- **Fix for sidebar tests**: Use `within(container.querySelector('aside')!)` to scope queries to the desktop variant; use `fireEvent.click` instead of `userEvent.click` to bypass pointer-event checks
- **Fix for hidden elements**: The desktop aside has `class="hidden md:block"` which makes it `display: none` in jsdom. Use `{ hidden: true }` option with `getByRole` to find elements inside it
- Polyfill `ResizeObserver` as a class (not a mock) for Radix ScrollArea: `class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }`

**Why**: These workarounds are necessary because jsdom lacks CSS layout engine features (media queries, computed visibility). Document them here to prevent future developers from debugging the same issues.

---

## Anti-pattern: Editing shadcn/ui Files Casually

**Don't do this**: Make ad-hoc edits to files in `src/components/ui/` without understanding the implications.

**Why it fails**: These files are generated by `npx shadcn add <component>`. Casual edits can break accessibility patterns from Radix UI, conflict with future component additions, or produce inconsistent styling. Prettier will also reformat them from the shadcn default style to our project style, which is fine.

**Do this instead**: If you need custom behavior, create a wrapper component in `src/components/` that imports and extends the shadcn primitive. Only edit `src/components/ui/` files when you have a clear reason and understand the Radix primitives underneath.

---

## Anti-pattern: Raw CSS or Inline Styles

**Don't do this**:
```tsx
<div style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
```

**Why it fails**: Bypasses the Tailwind design system and theme tokens. Inconsistent with the rest of the codebase.

**Do this instead**:
```tsx
<div className="bg-background text-foreground">
```

---

## Cloudflare Pages Functions (API Proxy)

**When to use**: For all server-side proxy code that forwards requests to AI providers.

- Pages Functions live in `functions/` at the project root
- File path maps to route: `functions/api/chat.ts` -> `POST /api/chat`
- Export `onRequestPost` for POST handlers, `onRequestOptions` for CORS preflight
- The `PagesFunction` type from `@cloudflare/workers-types` is available globally (no import needed)
- Functions have their own `functions/tsconfig.json` separate from the app's TS config
- Use `createAnthropic()`, `createOpenAI()`, `createGoogleGenerativeAI()` with `{ apiKey }` for BYOK pattern
- Use `streamText().toUIMessageStreamResponse()` to produce streams compatible with `useChat`
- Always add CORS headers to all responses (including error responses)

**Example**:
```ts
import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

export const onRequestPost: PagesFunction = async (context) => {
  const { model, messages, apiKey } = await context.request.json()
  const anthropic = createAnthropic({ apiKey })
  const result = streamText({ model: anthropic(model), messages })
  return corsResponse(result.toUIMessageStreamResponse())
}
```

**Why**: A unified proxy eliminates CORS issues across all three providers and keeps one code path for streaming, error handling, and testing.

---

## Proxy Error Handling

**When to use**: When handling errors in the API proxy.

- Map provider errors to a consistent JSON shape: `{ error: { code, message, provider? } }`
- Use HTTP status codes: 401 (auth), 429 (rate limit), 504 (timeout), 502 (provider outage), 400 (validation), 500 (unknown)
- Provide user-friendly error messages that don't leak raw provider details
- Use the AI SDK's `onError` callback in `toUIMessageStreamResponse()` for mid-stream errors

**Why**: The SPA can display consistent error UI regardless of which provider failed. The error shape is the same for pre-stream (HTTP response) and mid-stream (stream event) errors.

---

## Testing Cloudflare Pages Functions

**When to use**: When writing tests for code in `functions/`.

- Test files co-locate with source: `functions/api/chat.ts` → `functions/api/chat.test.ts`
- `functions/tsconfig.json` excludes `**/*.test.ts` (test files rely on Vitest for types)
- `vitest.config.ts` includes `functions/**/*.test.ts` alongside `src/` tests
- Mock AI SDK modules with `vi.mock()` factories declared before imports
- Create helper functions to build mock `EventContext` objects for `PagesFunction` handlers
- Test through exported handlers (`onRequestPost`, `onRequestOptions`), not internal functions

**Example** (mock pattern for AI SDK):
```ts
const mockStreamText = vi.fn()
vi.mock('ai', () => ({ streamText: mockStreamText }))

const mockCreateAnthropic = vi.fn()
vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic: mockCreateAnthropic }))
```

**Why**: Functions have their own TypeScript project and cannot share types with Vitest globals. Mocking at the module boundary keeps tests fast and avoids real API calls.

---

## useProviderChat Hook Pattern

**When to use**: For all provider chat instances in model columns.

- One `useProviderChat` instance per provider column, wrapping `@ai-sdk/react`'s `useChat`
- `DefaultChatTransport` created once via `useMemo(() => ..., [])`, reads dynamic values (provider, model, API key) through refs at request time
- `prepareSendMessagesRequest` callback reads API key from Dexie settings, converts `UIMessage` parts to `{role, content}` for the proxy
- Persistence sync: user messages saved to Dexie on `send()`, assistant messages on `onFinish`
- Message seeding: loads from Dexie when `conversationId` changes, clears on null
- Streaming status synced to Zustand store via `useEffect` for cross-component reactivity

**Example**:
```tsx
const { messages, send, isLoading, error, stop, clearError } = useProviderChat({
  provider: 'claude',
  conversationId: activeConversationId,
  model: 'claude-sonnet-4-20250514',
})
```

**Why**: Encapsulates all streaming, persistence, and state sync concerns in a single hook. Each column is fully self-contained — the parent only needs to call `send()`.

---

## Imperative Ref Pattern for Cross-Component Messaging

**When to use**: When a parent needs to trigger actions on child components (e.g., sending messages to multiple columns concurrently).

- Child exposes a handle type via `forwardRef` + `useImperativeHandle`
- Parent stores a `useRef<HandleType>` and calls methods in event handlers (never during render)
- Streaming/loading status shared via Zustand store, not by reading refs during render

**Example**:
```tsx
// Child component
export interface ModelColumnHandle {
  send: (text: string) => Promise<boolean>
}

export const ModelColumn = memo(
  forwardRef(function ModelColumn(props, ref: ForwardedRef<ModelColumnHandle>) {
    useImperativeHandle(ref, () => ({ send }), [send])
    // ...
  }),
)

// Parent
const claudeRef = useRef<ModelColumnHandle>(null)
const handleSend = async (text: string) => {
  await claudeRef.current?.send(text)
}
```

**Why**: Avoids prop-drilling callback chains and keeps the parent's send orchestration imperative while each column manages its own streaming state.

---

## Streaming Status via Zustand Store

**When to use**: When hook-local state (like `useChat`'s `status`) needs to be read by sibling or parent components during render.

- Each `useProviderChat` syncs its loading state to `useAppStore.streamingStatus[provider]` via `useEffect`
- Other components read `streamingStatus` from the store with granular selectors
- Never read imperative handle refs during render (violates React 19 rules)

**Example**:
```tsx
// Inside useProviderChat
useEffect(() => {
  const isActive = status === 'submitted' || status === 'streaming'
  setStreamingStatus(provider, isActive)
}, [status, provider, setStreamingStatus])

// In InputBar or App
const isAnyStreaming = useAppStore(
  (s) => s.streamingStatus.claude || s.streamingStatus.chatgpt || s.streamingStatus.gemini,
)
```

**Testing**: Reset `streamingStatus` in `beforeEach`:
```ts
useAppStore.setState({
  activeConversationId: null,
  sidebarOpen: false,
  streamingStatus: { claude: false, chatgpt: false, gemini: false },
})
```

**Why**: Zustand selectors are safe to read during render and minimize re-renders via equality checks.

---

## Anti-pattern: Reading Imperative Refs During Render

**Don't do this**:
```tsx
// In a parent component's render body
const isLoading = claudeRef.current?.isLoading // React 19 ESLint error
```

**Why it fails**: React 19's `react-hooks/refs` rule prohibits reading `ref.current` during render because refs are not tracked by React's reactivity system. The value may be stale or cause inconsistent renders.

**Do this instead**: Sync derived state to a Zustand store via `useEffect` in the child, and read it from the store in the parent/sibling (see "Streaming Status via Zustand Store" pattern above).

---

## Model & Provider Constants (`src/lib/models.ts`)

**When to use**: When referencing model IDs, display names, or provider-level display constants.

- `MODEL_OPTIONS`: Per-provider lists of available models (id + label), ordered by preference (default first)
- `MODEL_DISPLAY_NAMES`: Flat map from model ID to display name
- `getModelDisplayName(modelId)`: Lookup with fallback to raw ID for unknown models
- `PROVIDER_LABELS`: Human-readable provider names (`claude` → `'Claude'`)
- `PROVIDER_COLORS`: Tailwind accent color classes per provider (`claude` → `'bg-chart-1'`)

**Example**:
```ts
import { getModelDisplayName, PROVIDER_COLORS, PROVIDER_LABELS } from '@/lib/models'

// In a component
<span>{getModelDisplayName('claude-sonnet-4-20250514')}</span> // → "Sonnet 4"
<div className={cn('h-2 w-2 rounded-full', PROVIDER_COLORS[provider])} />
```

**Why**: Centralizes all model/provider display metadata in one module. When providers release new models, update only `src/lib/models.ts`. Both `SettingsDialog` and `ModelColumn` import from here.

---

## Settings Dual-Write Pattern (Dexie + Zustand)

**When to use**: When a user changes a setting that needs both persistence (survives reload) and immediate runtime effect.

- Write to Dexie via `updateSettings()` for persistence
- Update Zustand setter for immediate runtime effect
- API keys only need Dexie (read at request time via `getSettings()` in the transport callback)
- Model selections need both (Zustand `selectedModels` drives `useProviderChat`)
- On app mount, `App.tsx` syncs persisted settings from Dexie → Zustand

**Example**:
```ts
// In SettingsDialog — model change needs dual-write
const handleModelChange = async (modelId: string) => {
  await updateSettings({ selectedModels: { [provider]: modelId } })
  setSelectedModel(provider, modelId) // Zustand for immediate effect
}

// API key change only needs Dexie (read at request time)
const handleApiKeyChange = (value: string) => {
  updateSettings({ apiKeys: { [provider]: value } })
}
```

**Why**: Dexie is the source of truth for persistence. Zustand is the source of truth for runtime. The dual-write keeps them in sync without adding a reactive subscription from Zustand to Dexie.

---

## Debounced Input Saving

**When to use**: When a text input persists each change to Dexie (or any async store).

- Maintain local `useState` for the input value (instant visual feedback)
- Sync from parent prop via `useEffect` when external data changes
- Debounce the Dexie write with `setTimeout` (~300ms)
- Clean up the timer on unmount

**Example**:
```tsx
const [localValue, setLocalValue] = useState(propValue)
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

useEffect(() => { setLocalValue(propValue) }, [propValue])

const handleChange = (value: string) => {
  setLocalValue(value)
  if (debounceRef.current) clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => {
    updateSettings({ apiKeys: { [provider]: value } })
  }, 300)
}

useEffect(() => () => {
  if (debounceRef.current) clearTimeout(debounceRef.current)
}, [])
```

**Why**: Without debouncing, each keystroke fires a full Dexie read-write transaction. For a 50-character API key, that is 50 sequential IndexedDB transactions. Debouncing batches rapid changes into a single write.
