# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cortex is a unified tri-model AI workspace — a client-side SPA that sends user messages to Claude, ChatGPT, and Gemini simultaneously, maintaining independent conversation threads per model. Single-user tool, no auth.

## Tech Stack

- **Frontend:** Vite 7 + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **AI Streaming:** Vercel AI SDK (`ai`, `@ai-sdk/react`) with provider adapters (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`)
- **Persistence:** Dexie.js v4 (IndexedDB) — conversations, messages, API keys stored locally
- **State:** Zustand v5 for ephemeral UI state
- **API Proxy:** Cloudflare Workers (Pages Functions) — stateless proxy required because OpenAI and Gemini block browser CORS
- **Deployment:** Cloudflare Pages (SPA) + Pages Functions (proxy)

## Common Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + production build (output: dist/)
npm run test         # Run Vitest (unit/component/integration)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Run Playwright E2E tests
npm run lint         # ESLint
npm run format       # Prettier auto-format
npm run format:check # Prettier check (CI-friendly)
npm run dev:proxy    # Cloudflare proxy local dev (requires `npm run build` first)
npm run typecheck:functions  # Typecheck functions/ directory
```

## Architecture

### Data Flow
1. User types in shared input bar → message sent to all 3 providers concurrently
2. Each provider column has its own `useChat` instance with independent message history
3. All requests route through a Cloudflare Worker proxy (`POST /api/chat`) that forwards to provider APIs server-side
4. On stream completion, messages persist to IndexedDB via Dexie.js
5. On conversation load, messages read from Dexie and seeded into `useChat` instances

### Key Data Model (IndexedDB)
- **Conversation:** id, title, createdAt, updatedAt, modelConfig
- **Message:** id, conversationId, provider (`claude`|`chatgpt`|`gemini`), role, content, timestamp, tokenCount, isCrossFeed, crossFeedRound
  - Compound index: `[conversationId+provider+timestamp]`
- **Settings:** apiKeys, selectedModels, theme

No separate Thread entity — each thread is Messages filtered by provider within a conversation.

### Cross-Feed
Client-orchestrated: SPA reads latest responses from each model, constructs messages containing the other two models' responses, sends 3 concurrent requests. Proxy stays stateless.

### Performance Strategy
- Each model column wrapped in `React.memo` for stream isolation
- RAF buffering if needed for token rendering (60+ re-renders/sec from 3 streams)
- Lazy-load tiktoken, export logic
- Bundle target: < 200 KB gzipped

## Implementation Phases

13 sequential phases defined in `docs/IMPLEMENTATION-PLAN.md`. Key dependency: Phases 2-3 (data layer, app shell) and Phase 4 (proxy) can run in parallel. Phases 7-9 parallelize after Phase 6.

**Current status:** Phase 7 complete. Settings & API Key Management is fully implemented. `SettingsDialog` (gear icon in TopBar) provides per-provider API key inputs (debounced save to Dexie) and model selector dropdowns. Model constants centralized in `src/lib/models.ts`. Column headers show selected model display names. `App.tsx` syncs persisted settings from Dexie to Zustand on mount. First-run experience: pulsing gear icon when no API keys configured, InputBar disabled until at least one key is set. All three providers stream concurrently with error isolation via `Promise.allSettled`.

## Workflow: /implement Skill

Use `/implement <task>` for the full quality workflow:
1. **builder** agent implements the feature (reads CONVENTIONS.md)
2. **test-writer** agent writes tests
3. **code-reviewer** agent reviews → creates `docs/reviews/YYYY-MM-DD-review.md`
4. Fix Critical/Warning items from review
5. **doc-verifier** agent checks docs match implementation
6. Fix Critical doc issues
7. Update CONVENTIONS.md with new patterns; update `docs/DECISIONS.md` if architectural decisions were made

A pre-commit hook enforces all /implement phases completed before session exit (if /implement was invoked).

## Key Documentation

- `docs/PRODUCT.md` — Product spec, features, acceptance criteria
- `docs/BUILD-STRATEGY.md` — Tech stack rationale and architectural decisions
- `docs/IMPLEMENTATION-PLAN.md` — 13 phases with dependencies and exit criteria
- `CONVENTIONS.md` — Patterns and anti-patterns (create during Phase 1, update as patterns emerge)

## Custom Instructions

### Think Before Coding
- State assumptions explicitly. If uncertain, ask.
- If multiple valid approaches exist, present them with tradeoffs — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Goal-Driven Execution
Transform tasks into verifiable goals before implementing:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

### Surgical Changes
When editing existing code:
- Remove imports/variables/functions that YOUR changes made unused
- Don't remove pre-existing dead code unless asked (mention it instead)

### Session Startup Protocol
At the beginning of each session:
1. Read `docs/PRODUCT.md` to understand what we're building
2. Read `docs/BUILD-STRATEGY.md` for tech stack and architecture decisions
3. Read `CONVENTIONS.md` to understand current patterns and standards
4. Read `docs/IMPLEMENTATION-PLAN.md` to understand the phase breakdown and current progress
5. Read `README.md` (if it exists) for project overview
6. Signal readiness by saying: "⏱️ So much time and so little to do. Wait. Strike that. Reverse it."

### During Implementation
- Follow patterns established in `CONVENTIONS.md` (if any exist)
- If you encounter a decision not covered by existing conventions, make a reasonable choice and document it
- Commit frequently with clear messages

### Completing Work
> When using the `/implement` pipeline, these steps are handled automatically by Step 7 (Finalize). Follow these manually only in non-pipeline sessions.

1. Review `CONVENTIONS.md` — see Compound Engineering Protocol below
2. Signal completion by saying: "🧪 Invention is 93% perspiration, 6% electricity, 4% evaporation, and 2% butterscotch ripple. Do you concur?"

### Git Conventions
- Keep commits focused and atomic

### Compound Engineering Protocol
This protocol ensures the codebase gets smarter over time. It is **not optional**—execute it after every implementation session.

> When using the `/implement` pipeline, this protocol is executed automatically in Step 7. Follow it manually in non-pipeline sessions.

**After completing any implementation work:**
1. Review `CONVENTIONS.md`
2. Ask yourself:
   - Did I establish any new patterns that should be replicated?
   - Did I discover that an existing pattern was problematic?
   - Did I try an approach that failed and should be documented as an anti-pattern?
3. If yes to any: Update `CONVENTIONS.md` with the learning
4. For significant architectural changes: Add entry to `docs/DECISIONS.md`

**After resolving any bug or unexpected behavior:**
1. Identify root cause
2. Determine if it was caused by:
   - Missing pattern → Add the pattern to `CONVENTIONS.md`
   - Wrong pattern → Update the pattern in `CONVENTIONS.md`
   - One-off issue → No convention update needed
3. If a pattern caused the bug, document it as an anti-pattern with:
   - What the bad approach was
   - Why it failed
   - What the correct approach is

**Format for new patterns:**
```markdown
## [Pattern Name]
**When to use**: [Criteria]
**Example**:
```[language]
// Example code
```
**Why**: [Brief rationale]
```

**Format for anti-patterns:**
```markdown
## [Anti-pattern Name]
**Don't do this**:
```[language]
// Bad example
```
**Why it fails**: [What went wrong]
**Do this instead**:
```[language]
// Correct approach
```

### When to Ask for Human Input
- Unclear or ambiguous requirements
- Decisions that significantly deviate from established patterns
- Security-sensitive implementations
- External service integrations not covered in `docs/BUILD-STRATEGY.md`
- When stuck after 2-3 different approaches
- When unsure if a pattern change is warranted
