# Code Review -- Phase 4 (API Proxy) -- 2026-02-28

## Summary

Phase 4 implements a Cloudflare Pages Function at `POST /api/chat` that serves as a stateless CORS proxy for three AI providers (Anthropic, OpenAI, Google). The implementation is well-structured, with thorough request validation, consistent error mapping, proper CORS handling, and comprehensive tests (66 passing). The proxy code itself (`functions/api/chat.ts`) is clean and production-ready. However, there are a few issues that need attention: the functions `tsconfig.json` includes test files and breaks `tsc -b` / `typecheck:functions`, the AI SDK packages are incorrectly categorized as `dependencies` instead of `devDependencies`, and the CORS policy uses a wildcard origin which should be narrowed before production deployment. The test file and vitest config change also remain uncommitted.

## Files Reviewed

- `functions/api/chat.ts` -- Main proxy endpoint (345 lines, committed)
- `functions/api/chat.test.ts` -- Tests for the proxy (935 lines, **uncommitted**)
- `functions/tsconfig.json` -- TypeScript config for functions (committed)
- `wrangler.jsonc` -- Cloudflare Pages config (committed)
- `package.json` -- New dependencies and scripts (committed)
- `tsconfig.json` -- Project reference for functions (committed)
- `.gitignore` -- `.wrangler/` exclusion (committed)
- `CONVENTIONS.md` -- New patterns for proxy (committed)
- `vitest.config.ts` -- Include functions tests (**uncommitted**)

## Critical (Must Fix)

- [ ] **Functions tsconfig includes test files, breaking `tsc -b` and `typecheck:functions`** -- `functions/tsconfig.json:18` -- The `include` pattern `"./**/*.ts"` captures `chat.test.ts`, which uses Vitest globals (`describe`, `it`, `expect`) not available in the functions tsconfig's `types` array (only `@cloudflare/workers-types`). Running `tsc -p functions/tsconfig.json` or `tsc -b` produces 100+ type errors. **Fix**: Exclude test files from the functions tsconfig by adding `"exclude": ["./**/*.test.ts"]`, or change the include to `"./**/!(*test).ts"`. This follows the same pattern used in `tsconfig.app.json` which excludes `src/**/*.test.ts`.

- [ ] **Test file and vitest.config.ts change are uncommitted** -- `functions/api/chat.test.ts` and `vitest.config.ts` -- The test file is untracked and the vitest config change is unstaged. These appear to have been left out of both Phase 4 commits (`3bd32a8`, `b4bdeff`). They must be committed for the test suite to include proxy tests when running `npm run test`. Without the vitest config change, `functions/**/*.test.ts` would not be picked up at all.

## Warnings (Should Fix)

- [ ] **AI SDK packages are listed as `dependencies` but should be `devDependencies`** -- `package.json:19-22` -- The `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, and `@ai-sdk/google` packages are only imported in `functions/api/chat.ts`, which is a Cloudflare Pages Function. Cloudflare's build process bundles functions separately; these packages are never imported from `src/` and do not end up in the client-side Vite bundle. Per the project's own Dependency Categorization convention in `CONVENTIONS.md`: `dependencies` are for "packages whose code/CSS is imported into `src/` files at runtime" and `devDependencies` are for "build-time, test-time, or lint-time only tools." Since the AI SDK is used exclusively by the server-side proxy (bundled at deploy time, not at runtime in the browser), they belong in `devDependencies`. **Note**: Phase 5 will introduce `@ai-sdk/react` and `ai` imports into `src/` -- at that point `ai` would correctly move to `dependencies`, but the three provider adapters (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`) should remain `devDependencies` as they will only ever be imported server-side.

- [ ] **The `invalid_model` error matcher is overly broad** -- `functions/api/chat.ts:150` -- The condition `messageLower.includes('not found') || messageLower.includes('model')` will match any error message containing the word "model" even when unrelated to model lookup. For example, an error like "The content moderation model flagged this request" would incorrectly map to a 400 `invalid_model` error. Consider making the condition more specific, e.g., requiring both "model" and "not found"/"not available"/"does not exist" together, or checking for the `model` keyword only when combined with other signals.

- [ ] **`dev:proxy` script may not work as intended** -- `package.json:17` -- The script `"dev:proxy": "wrangler pages dev dist"` requires a pre-built `dist/` directory. If a developer runs `npm run dev:proxy` without first running `npm run build`, it will serve an empty or stale `dist/`. Consider chaining the commands (e.g., `"dev:proxy": "npm run build && wrangler pages dev dist"`) or documenting this prerequisite clearly.

- [ ] **CORS allows all origins (`*`)** -- `functions/api/chat.ts:43` -- While acceptable for local development and a single-user tool, `Access-Control-Allow-Origin: *` means any website can make requests to this proxy endpoint if deployed publicly. Since the proxy forwards user-supplied API keys, a malicious page could trick a user's browser into sending their keys to the proxy. For production deployment (Phase 13), consider restricting the origin to the actual deployed domain. This could be done via an environment variable or Cloudflare Workers environment binding.

## Suggestions (Consider)

- [ ] **Add request body size validation** -- An adversarial or buggy client could send extremely large payloads (e.g., messages array with thousands of entries, or multi-megabyte content strings). Consider adding a Content-Length check or a maximum message count/size limit before parsing the full body. Cloudflare Workers have a 100MB limit per request, but provider APIs have their own context window limits that would produce confusing errors if hit through massive payloads.

- [ ] **Consider logging for observability** -- The proxy currently has no logging. While it is intentionally stateless, adding `console.log` or `console.error` for request metadata (provider, model, message count -- never API keys or content) and errors would aid debugging in production. Cloudflare Workers logs are available in the dashboard and via `wrangler tail`.

- [ ] **The `system` role is intentionally rejected, but this may need revisiting** -- `functions/api/chat.ts:224` -- The validation only accepts `user` and `assistant` roles. The Vercel AI SDK's `useChat` hook can send `system` messages in some configurations. If cross-feed or future features need system prompts, this validation will need updating. The current restriction is correct for Phase 4 scope; just noting it for awareness.

- [ ] **Consolidate the CORS preflight tests** -- `functions/api/chat.test.ts:125-155` -- The five individual CORS header tests for `onRequestOptions` each create a separate response. These could be consolidated into a single test that checks all headers, or into two tests (status + all headers). This is purely a readability suggestion; the current approach is correct.

- [ ] **Consider adding a `functions/tsconfig.test.json`** -- Since the functions directory has its own tsconfig that differs from the app config (no DOM lib, different types), a dedicated test tsconfig for functions would allow typechecking the test file separately. Alternatively, the test file could be excluded from the functions tsconfig (as recommended in Critical #1) and rely solely on Vitest for type inference at runtime.

- [ ] **`verbatimModuleSyntax` in functions tsconfig may cause issues with some AI SDK re-exports** -- `functions/tsconfig.json:13` -- This flag requires explicit `type` annotations on type-only imports. If any of the AI SDK packages re-export types without `type` keywords, this could produce errors during typechecking. Currently not an issue, but worth monitoring when upgrading AI SDK versions.

## Convention Compliance

**Compliant:**
- Functions directory structure follows the convention documented in CONVENTIONS.md (`functions/` at project root, `functions/api/chat.ts` maps to `POST /api/chat`)
- Error response shape matches the convention: `{ error: { code, message, provider? } }`
- HTTP status codes follow the documented mapping (401, 429, 504, 502, 400, 500)
- CORS headers are applied to all responses including errors, as required by convention
- `onRequestPost` and `onRequestOptions` exports follow the Pages Functions convention
- `PagesFunction` type is used globally without import, as noted in conventions
- `wrangler` and `@cloudflare/workers-types` are correctly in `devDependencies`
- `.wrangler/` is properly excluded in `.gitignore`
- Test file follows `.test.ts` naming convention (not `.spec.ts`)

**Non-compliant:**
- AI SDK packages (`ai`, `@ai-sdk/anthropic`, etc.) are in `dependencies` but per the Dependency Categorization convention they should be in `devDependencies` since they are not imported in `src/` files (see Warning #1)
- Test file is not committed (convention: "Test files live next to the code they test")

## Patterns to Document

1. **Functions test file exclusion pattern** -- Once the tsconfig issue is fixed, document the pattern for excluding test files from the functions tsconfig while still including them in the vitest config. This mirrors the existing `tsconfig.app.json` exclusion pattern for `src/` test files.

2. **Mock pattern for AI SDK in tests** -- The test file establishes a clean pattern for mocking `streamText`, `createAnthropic`, `createOpenAI`, and `createGoogleGenerativeAI` using `vi.mock` with factory functions declared before the module import. This pattern should be referenced if other tests need to mock AI SDK functions.
