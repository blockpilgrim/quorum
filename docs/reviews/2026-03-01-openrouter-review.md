# Code Review -- 2026-03-01 (OpenRouter Migration for Gemini)

## Summary

This review covers commit `30217cb` which routes Gemini requests through OpenRouter instead of Google's API directly, replacing `@ai-sdk/google` with `@openrouter/ai-sdk-provider`. The core proxy, model definitions, pricing, and tests are all updated consistently. The implementation is correct and well-structured: the `providerOptions.openrouter.reasoning` shape matches the `@openrouter/ai-sdk-provider` v2.2.3 type definitions exactly, all 405 tests pass, and both `tsconfig.app.json` and `functions/tsconfig.json` typecheck clean. However, there are several stale references to the old Google/Gemini provider in documentation, conventions, and sibling test files that were not updated as part of this commit.

## Files Reviewed

- `functions/api/chat.ts` -- proxy implementation
- `functions/api/chat.test.ts` -- proxy tests
- `src/lib/models.ts` -- model definitions
- `src/lib/models.test.ts` -- model definition tests
- `src/lib/pricing.ts` -- pricing table
- `src/lib/pricing.test.ts` -- pricing tests
- `src/components/SettingsDialog.tsx` -- UI placeholder text
- `package.json` -- dependency swap

## Critical (Must Fix)

- [ ] **JSDoc comment on `PROVIDER_OPTIONS` still describes old Gemini config** -- `functions/api/chat.ts:281` -- The comment says "Gemini: thinkingConfig with high level and thoughts included" but the actual implementation now uses `openrouter: { reasoning: { effort: 'high' } }`. Update the comment to: "Gemini (via OpenRouter): reasoning effort set to 'high'".

- [ ] **`CONVENTIONS.md` has stale Gemini provider options documentation** -- `CONVENTIONS.md:367` says to use `createGoogleGenerativeAI()` for the BYOK pattern. Line 408 shows the old Gemini config: `google` | `thinkingConfig: { thinkingLevel: 'high', includeThoughts: true }`. Both must be updated to reflect OpenRouter. The Cloudflare Pages Functions convention (line 367) should reference `createOpenRouter()` for Gemini, and the Provider Options table (line 404-408) should show `openrouter` | `reasoning: { effort: 'high' }`.

- [ ] **`CLAUDE.md` still references `@ai-sdk/google` in the tech stack** -- `CLAUDE.md:13` lists `@ai-sdk/google` as a provider adapter. This should be replaced with `@openrouter/ai-sdk-provider`. The current status paragraph at line 66 also references "thinkingConfig for Gemini" which should say "reasoning effort via OpenRouter for Gemini".

## Warnings (Should Fix)

- [ ] **Multiple sibling test files still use old `gemini-2.5-flash` model ID** -- The following test files use `gemini-2.5-flash` as the Gemini model ID in their test fixtures. While these tests still pass (model IDs in fixtures are arbitrary strings for those tests), they create a misleading picture of the system's actual model configuration:
  - `src/hooks/useProviderChat.test.ts:196` -- `model: 'gemini-2.5-flash'`
  - `src/lib/store.test.ts:13` -- `gemini: 'gemini-2.5-flash'`
  - `src/lib/store.test.ts:57` -- `expect(selectedModels.gemini).toBe('gemini-2.5-flash')`
  - `src/lib/db/messages.test.ts:22` -- `gemini: 'gemini-2.5-flash'`
  - `src/lib/db/conversations.test.ts:24` -- `gemini: 'gemini-2.5-flash'`
  - `src/lib/export.test.ts:39,208` -- `gemini: 'gemini-2.5-flash'`
  - `src/components/SettingsDialog.test.tsx:28` -- `gemini: 'gemini-2.5-flash'`
  - `src/components/ConversationSearch.test.tsx:52` -- `gemini: 'gemini-2.5-flash'`
  - `src/components/ConversationSidebar.test.tsx:32` -- `gemini: 'gemini-2.5-flash'`
  - `src/components/UsageSummary.test.tsx:26` -- `gemini: 'gemini-2.5-flash'`

  Suggested fix: Update all test fixtures to use `google/gemini-3.1-pro-preview`. Since the store and settings defaults derive from `DEFAULT_MODELS` (which now points to the new ID), any test that checks the default will already work correctly at runtime, but the hardcoded fixture strings are misleading.

- [ ] **`docs/DECISIONS.md` entry 008 still references old Gemini thinking config** -- `docs/DECISIONS.md:103-107` describes Gemini using `thinkingLevel: 'high'` with `includeThoughts: true`. This decision entry should be updated to reflect the new OpenRouter routing and reasoning configuration, or a new decision entry (009) should be added documenting the migration rationale.

- [ ] **`docs/BUILD-STRATEGY.md` still lists `@ai-sdk/google`** -- `docs/BUILD-STRATEGY.md:23` and `docs/BUILD-STRATEGY.md:123` reference `@ai-sdk/google` as part of the tech stack. These should be updated to `@openrouter/ai-sdk-provider`.

- [ ] **`docs/IMPLEMENTATION-PLAN.md` references `@ai-sdk/google`** -- `docs/IMPLEMENTATION-PLAN.md:112` lists `@ai-sdk/google` as a provider adapter. Should be updated.

## Suggestions (Consider)

- [ ] **Gemini reduced to a single model** -- The previous configuration had two Gemini models (2.5 Flash and 2.5 Pro). The new configuration has only `google/gemini-3.1-pro-preview`. This is presumably intentional (the specific model available on OpenRouter), but it reduces user choice for the Gemini column. Consider adding `google/gemini-2.5-flash` or another budget Gemini model via OpenRouter if available, to maintain parity with the two-model options for Claude and ChatGPT.

- [ ] **Pricing may differ through OpenRouter** -- The pricing in `src/lib/pricing.ts` shows $1.25/$10 per 1M tokens for Gemini 3.1 Pro via OpenRouter. OpenRouter may apply a small markup over Google's direct pricing. Consider verifying these prices match the current OpenRouter pricing page and adding a comment noting that prices reflect OpenRouter rates, not Google direct rates.

- [ ] **No migration path for existing users with Google API keys** -- Users who previously saved a Google API key will now need an OpenRouter API key instead. The placeholder text in `SettingsDialog.tsx` was correctly updated to say "OpenRouter" for the gemini provider, but there is no migration or warning for users who have an existing Google API key stored in IndexedDB. Consider clearing stale Gemini API keys on app startup or showing a one-time notice.

## Convention Compliance

The implementation follows established conventions well:

- **Testing conventions**: Test files co-located, mocks declared before imports, `vi.mock()` factories match the established pattern.
- **Pure functions**: Pricing remains pure. Model definitions remain centralized.
- **Proxy pattern**: `createModel` switch and `PROVIDER_OPTIONS` map follow the same structure as before.
- **Dependency categorization**: `@openrouter/ai-sdk-provider` is correctly placed in `devDependencies` (used only in `functions/`, which is build-time for the proxy).

However, the Compound Engineering Protocol was not fully followed -- `CONVENTIONS.md` was not updated to reflect the new provider patterns established by this commit.

## Patterns to Document

The following patterns should be added or updated in `CONVENTIONS.md`:

1. **OpenRouter as Gemini proxy**: Document that Gemini routes through OpenRouter (not Google directly), requiring an OpenRouter API key. Update the Cloudflare Pages Functions convention to show `createOpenRouter()` alongside `createAnthropic()` and `createOpenAI()`.

2. **Provider Options table update**: The `PROVIDER_OPTIONS` table in CONVENTIONS.md should reflect:
   | Provider | SDK Key | Config |
   |----------|---------|--------|
   | Claude | `anthropic` | `thinking: { type: 'adaptive' }` |
   | OpenAI | `openai` | `reasoningEffort: 'high'` |
   | Gemini | `openrouter` | `reasoning: { effort: 'high' }` |

3. **OpenRouter model ID format**: Document that OpenRouter model IDs use the `provider/model-name` format (e.g., `google/gemini-3.1-pro-preview`), which differs from the direct provider format.
