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
