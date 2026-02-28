# Conventions

Patterns and anti-patterns for the Cortex codebase. Updated as the project evolves.

---

## Project Structure

**When to use**: Always. Follow this directory layout for all new code.

```
src/
  components/
    ui/          # shadcn/ui primitives (auto-generated, do not hand-edit)
  lib/           # Shared utilities (cn(), helpers)
  hooks/         # Custom React hooks
  test/          # Test setup and shared test utilities
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
