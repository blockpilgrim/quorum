# Architectural Decisions

Significant decisions made during implementation. Referenced by CLAUDE.md's Compound Engineering Protocol.

---

## 001: Vite 7 instead of Vite 6

**Date:** 2026-02-28
**Phase:** 1

**Context:** CLAUDE.md and BUILD-STRATEGY.md originally specified Vite 6. Running `npm create vite@latest` installed Vite 7.3.1 (current stable).

**Decision:** Use Vite 7 as-is. No breaking changes affect this project.

**Consequence:** Updated all documentation references from "Vite 6" to "Vite 7".

---

## 002: Exclude test files from tsconfig.app.json

**Date:** 2026-02-28
**Phase:** 1

**Context:** Test files use Vitest globals (`describe`, `it`, `expect`) which aren't recognized by the app TypeScript config. Including test files in the build causes type errors.

**Decision:** Add `"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test"]` to `tsconfig.app.json`. Test files get their types from Vitest's own configuration.

**Consequence:** `tsc -b` (used in `npm run build`) only checks application code. Vitest handles type-checking test files separately.

---

## 003: UI Message Stream format for proxy responses

**Date:** 2026-02-28
**Phase:** 4

**Context:** The AI SDK offers multiple stream response formats: `toTextStreamResponse()` (plain text stream), `toDataStreamResponse()` (data protocol stream), and `toUIMessageStreamResponse()` (UI message stream). The proxy needs to return a format that the client-side `useChat` hook can consume.

**Decision:** Use `toUIMessageStreamResponse()` which outputs the UI message stream protocol compatible with AI SDK v6's `useChat` hook.

**Consequence:** The client uses `DefaultChatTransport` from the `ai` package with `prepareSendMessagesRequest` for request customization, paired with `useChat({ transport })`. This is the default transport in AI SDK v6 and parses the UI message stream format natively. Token usage metadata is included in the stream. Mid-stream errors are surfaced via the `onError` callback.

---

## 004: Provider type duplicated between SPA and functions

**Date:** 2026-02-28
**Phase:** 4

**Context:** The `Provider` type (`'claude' | 'chatgpt' | 'gemini'`) is needed in both `src/lib/db/types.ts` (SPA) and `functions/api/chat.ts` (proxy). The functions directory has its own TypeScript project and cannot import from `src/`.

**Decision:** Duplicate the type definition in both locations. Do not create a shared types package.

**Consequence:** If the provider list changes, both files must be updated. This is acceptable given the type is a simple union of 3 literals that changes rarely. A shared package can be extracted later if needed.

---

## 005: Cross-feed as pure functions + SendOptions extension

**Date:** 2026-03-01
**Phase:** 8

**Context:** Cross-feed needs to construct per-provider messages (each containing the other two models' responses), send them concurrently, and persist them with `isCrossFeed`/`crossFeedRound` metadata. Several approaches were considered: (a) a separate `sendCrossFeed()` method on the hook, (b) a `CrossFeedManager` class, (c) pure utility functions + optional `SendOptions` on the existing `send()`.

**Decision:** Use pure utility functions in `src/lib/crossfeed.ts` for message construction, and extend the existing `send(text, options?)` signature with an optional `SendOptions` parameter for metadata. Orchestration lives in `App.tsx`'s `handleCrossFeed` callback. Cross-feed visual state tracked via a `Set<string>` of UIMessage IDs in `useProviderChat`.

**Consequence:** Cross-feed message construction is trivially testable (24 pure function tests). The `send()` API remains backward-compatible. The `Set<string>` tracking grows within a session but resets on conversation switch and rebuilds from Dexie on load. No new hooks or classes needed — cross-feed is an orchestration concern in the parent, not a per-column concern.

---

## 006: API-only token counting (no client-side tiktoken)

**Date:** 2026-03-01
**Phase:** 10

**Context:** BUILD-STRATEGY.md Decision #4 planned a "hybrid approach" combining API response token counts with client-side `js-tiktoken` for pre-send estimation. Phase 10 implemented token usage capture from API responses via the `messageMetadata` callback in the proxy's `toUIMessageStreamResponse`.

**Decision:** Use API response token counts exclusively. Do not install `js-tiktoken`. Token counts are extracted from the `finish` stream event and sent to the client as `UIMessage.metadata.usage`.

**Consequence:** No pre-send token estimation (user cannot see "this message will cost approximately X" before sending). Token counts are only available after the response completes. This keeps the bundle smaller (~2KB saved from tiktoken encoding data) and avoids complexity from provider-specific tokenizer differences. Pre-send estimation can be added later if needed.

---

## 007: Cost estimates use currently-selected model

**Date:** 2026-03-01
**Phase:** 10

**Context:** The `UsageSummary` component calculates costs using `selectedModels[provider]` from the Zustand store. If a user switches models mid-conversation (e.g., from Opus to Haiku), all historical costs are recalculated at the new model's price. The `Message` type does not store which model generated it.

**Decision:** Accept this limitation for the MVP. Document it in the UI with "Costs estimated using currently selected models." The correct long-term fix is to add a `model: string` field to the `Message` schema and use it for cost lookups, but this requires a Dexie schema migration and touches many persistence paths.

**Consequence:** Cost estimates may be inaccurate when users switch models within a conversation. This is a known limitation documented in the UI and in this decision log. Adding `model` to `Message` is deferred to a future phase.

---

## 008: Always-on thinking/reasoning via providerOptions

**Date:** 2026-03-01
**Phase:** Post-Phase 12 (model update)

**Context:** All three providers now support thinking/reasoning modes: Claude has adaptive thinking, OpenAI has reasoning effort levels, and Gemini has thinkingConfig with thinkingLevel. The question was whether to (a) make thinking a user-configurable setting, (b) enable it by default with opt-out, or (c) always enable it.

**Decision:** Always enable thinking/reasoning for all providers at high levels. Configuration is a static `PROVIDER_OPTIONS` map in the proxy, not user-configurable. Claude uses `adaptive` thinking (model decides when/how deeply), OpenAI uses `reasoningEffort: 'high'`, and Gemini uses `thinkingLevel: 'high'` with `includeThoughts: true`. Reasoning content is streamed to the client via `sendReasoning: true`.

**Consequence:** All responses include thinking/reasoning, which improves response quality but increases token usage and cost. There is no UI toggle to disable thinking. The `PROVIDER_OPTIONS` map is per-provider, not per-model — all models for a given provider share the same thinking config. If a future budget model does not support thinking, this structure will need to become model-aware. Adding user-configurable reasoning effort levels is a future enhancement.
