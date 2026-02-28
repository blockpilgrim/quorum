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
