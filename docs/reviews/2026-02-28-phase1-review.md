# Code Review -- 2026-02-28: Phase 1 Scaffold

## Summary

Reviewed the complete Phase 1 scaffold of the Cortex MVP: a Vite 6 + React 19 + TypeScript project with Tailwind CSS v4, shadcn/ui components, Vitest unit tests, and Playwright E2E configuration. Overall quality is strong. The scaffold is well-structured, conventions are documented, tooling is properly configured, and tests are meaningful for a scaffold phase. There are a few items worth addressing -- one correctness issue with `'use client'` directives, one theme token inconsistency worth understanding, one test file placement that deviates from conventions, and a few minor suggestions.

## Files Reviewed

### Source
- `src/App.tsx`
- `src/main.tsx`
- `src/index.css`
- `src/lib/utils.ts`
- `src/test/setup.ts`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/scroll-area.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`

### Tests
- `src/lib/utils.test.ts`
- `src/App.test.tsx`
- `src/components/ui/ui-components.test.tsx`

### Config
- `package.json`
- `vite.config.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- `eslint.config.js`
- `.prettierrc`, `.prettierignore`
- `components.json`
- `.gitignore`
- `index.html`

### Other
- `e2e/.gitkeep`

## Critical (Must Fix)

None.

## Warnings (Should Fix) — All Resolved

- [x] **`'use client'` directive in a non-Next.js project** -- `src/components/ui/dialog.tsx:1` -- This file has `'use client'` at the top, which is a Next.js/RSC directive. The project uses Vite with `"rsc": false` set in `components.json`, so this directive is inert dead code. It does not break anything, but it is inconsistent: `dialog.tsx` has it while `button.tsx`, `input.tsx`, `scroll-area.tsx`, and `sheet.tsx` do not. Either remove it from `dialog.tsx` or add it to all shadcn components for consistency. Removing is recommended since this is not an RSC project.

- [x] **Test file co-location violation** -- `src/components/ui/ui-components.test.tsx` -- CONVENTIONS.md states: "Test files live next to the code they test: `Component.tsx` -> `Component.test.tsx`." This single test file tests five different components (Button, Input, ScrollArea, Dialog, Sheet) from a single file placed inside the `ui/` directory. Two concerns: (1) The test file is a single aggregate rather than per-component co-located files. (2) CONVENTIONS.md also says `src/components/ui/` contains "auto-generated, do not hand-edit" files, yet there is a hand-written test file inside that directory. **Suggested fix:** Either move the test to `src/components/ui.test.tsx` (one level up, testing all UI primitives as a smoke-test suite), or split into per-component test files if you want strict co-location. Given these are shadcn primitives unlikely to need deep testing, a single smoke-test file one level up is reasonable.

- [x] **`renderWithUser` helper defined after usage** -- `src/components/ui/ui-components.test.tsx:203-209` -- The `import userEvent` statement and `renderWithUser` helper function are defined at the bottom of the file, after the `describe` blocks that use them. While JavaScript hoisting makes this work for function declarations, the `import` statement at line 203 is placed after all the test code rather than at the top of the file with the other imports. This is a readability concern and goes against standard import ordering. **Suggested fix:** Move the `import userEvent` to the top of the file with the other imports, and move the `renderWithUser` helper either to the top (below imports) or to a shared test utility in `src/test/`.

- [x] **Theme token inconsistency: `@theme inline` card color vs `.dark` CSS variable** -- `src/index.css:10` vs `src/index.css:98` -- In the `@theme inline` block (Tailwind v4), `--color-card` is set to `oklch(0.145 0 0)` (same as background). In the `.dark` CSS variables block, `--card` is set to `oklch(0.205 0 0)` (slightly lighter than background). These two systems serve different purposes (Tailwind v4 theme vs shadcn CSS variables), but the values should ideally agree for the dark theme to avoid confusion. The `@theme inline` block appears to be the one Tailwind v4 actually uses for utility classes, while the `:root`/`.dark` variables are used by shadcn components via `var()`. If a component uses `bg-card` (Tailwind utility), it gets `oklch(0.145 0 0)`. If it uses `var(--card)` directly, it gets `oklch(0.205 0 0)` in dark mode. **Suggested fix:** Verify which system is authoritative and align the values, or document why they intentionally differ. The same discrepancy exists for `--color-border`/`--border` and `--color-input`/`--input` (the `@theme inline` block uses solid oklch values while `.dark` uses oklch with alpha channel).

## Suggestions (Consider)

- [ ] **Consider adding `@tailwindcss/vite` to `vitest.config.ts`** -- The Vite config includes the Tailwind CSS plugin, but the Vitest config does not. Currently `css: true` is set in the Vitest config, meaning CSS is processed but without the Tailwind plugin. This is fine for the current tests (they do not assert on computed styles), but if future tests need to verify Tailwind-generated classes or visual rendering, the Tailwind plugin may need to be added to Vitest as well.

- [ ] **Consider replacing the Vite favicon reference** -- `index.html:5` references `/vite.svg` as the favicon. The file exists in `public/`, but for a product called "Cortex" a custom favicon would be more appropriate. Low priority for Phase 1 but worth a task item for later.

- [ ] **Consider adding `node_modules` to `.prettierignore`** -- `.prettierignore` currently lists `dist`, `node_modules`, and `*.md`. This is fine since Prettier typically ignores `node_modules` by default, but having it explicit is good practice. This is already correct -- no action needed.

- [x] **Vitest include pattern accepts `.spec` files despite convention** -- `vitest.config.ts:17` has `include: ['src/**/*.{test,spec}.{ts,tsx}']` which matches both `.test.` and `.spec.` files. CONVENTIONS.md explicitly says "Use the `.test.ts` or `.test.tsx` extension (not `.spec`)." While having the broader glob is not harmful (it is a safety net), it could be tightened to `['src/**/*.test.{ts,tsx}']` to enforce the convention mechanically. This is a matter of preference -- the current approach is permissive rather than prescriptive.

- [x] **`@tailwindcss/vite` is listed in `dependencies` rather than `devDependencies`** -- `package.json:18` -- The `@tailwindcss/vite` plugin is a build-time tool and should be in `devDependencies` alongside `vite` itself. Similarly, `tailwindcss` (line 26) could be argued as a devDependency since it is a build-time CSS processor (though shadcn projects sometimes list it in dependencies). In practice this has no effect on the production bundle since Vite tree-shakes everything, but for correctness of the dependency manifest it is worth moving.

- [x] **`tw-animate-css` is listed in `devDependencies` but is a runtime CSS import** -- `package.json:47` -- `tw-animate-css` is imported at runtime in `src/index.css` (line 2: `@import 'tw-animate-css'`). It should arguably be in `dependencies` since it provides CSS consumed by the app. Again, Vite handles this correctly regardless, but the manifest is technically inaccurate.

## Convention Compliance

**Strong adherence overall.** Specific notes:

1. **Import aliases**: All imports use `@/` paths as required. No relative imports found in application code. PASS.
2. **Dark mode as default**: `index.html` has `class="dark"` on `<html>` and `class="dark bg-background text-foreground"` on `<body>` as specified. PASS.
3. **Tailwind theme tokens**: `App.tsx` exclusively uses semantic tokens (`bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-card-foreground`, `text-muted-foreground`, `bg-chart-*`). No hardcoded color values. PASS.
4. **shadcn/ui components**: Properly placed in `src/components/ui/`, using Radix UI primitives, with `@/` imports. PASS.
5. **Testing conventions**: `.test.ts`/`.test.tsx` extensions used (not `.spec`). Vitest globals enabled. RTL configured with jsdom. Setup file loads jest-dom matchers. PASS (except co-location issue noted in Warnings).
6. **ESLint + Prettier**: Both configured. `eslint-config-prettier` disables conflicting rules. `prettier-plugin-tailwindcss` included. Format scripts present. PASS.
7. **Project structure**: Follows the documented directory layout. PASS.
8. **No raw CSS or inline styles**: No inline `style` attributes found in application code. PASS.

## Patterns to Document

1. **Dependency categorization convention**: Consider adding a note to CONVENTIONS.md about which packages belong in `dependencies` vs `devDependencies`. A simple rule: "If the package provides code/CSS that is imported into `src/` files, it belongs in `dependencies`. If it is only used during build, test, or lint, it belongs in `devDependencies`."

2. **shadcn/ui `'use client'` handling**: Since this is a Vite (non-RSC) project, document that `'use client'` directives should be removed from shadcn components after generation, or that they are harmless and can be ignored. This prevents inconsistency across component files.

3. **Test placement for shadcn/ui primitives**: Clarify in CONVENTIONS.md whether shadcn/ui components should have co-located test files (which conflicts with "do not hand-edit" guidance for that directory) or whether a single smoke-test suite outside the `ui/` directory is the preferred pattern.
