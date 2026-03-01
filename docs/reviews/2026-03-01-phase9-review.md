# Code Review — 2026-03-01 — Phase 9: Conversation Management

## Summary

Phase 9 implements the full conversation lifecycle: rename, delete with cascade, model config restore on switch, and improved title generation. The overall quality is solid. The `ConversationItem` extraction is well-structured, accessibility is handled correctly, delete cascades through the existing Dexie transaction, and the test suite covers the critical paths including edge cases (empty rename, same-title rename, deleting active vs. non-active conversation). There is one critical race condition in the `handleDelete` callback where a stale closure can cause the active conversation to not be cleared on deletion. There are also a few moderate-severity items around the `confirmRename` button triggering a double-write via `onBlur`, and missing test coverage for the model config restore feature.

## Files Reviewed

- `src/App.tsx` — Model config restore on conversation switch, `generateTitle` extraction, `getConversation` import
- `src/components/ConversationSidebar.tsx` — `ConversationItem` extraction with inline rename and delete confirmation
- `src/components/ui/alert-dialog.tsx` — shadcn/ui AlertDialog (CLI-generated, not reviewed for logic)
- `src/lib/utils.ts` — `generateTitle()` function (extracted from App.tsx)
- `src/lib/utils.test.ts` — 10 unit tests for `generateTitle`
- `src/components/ConversationSidebar.test.tsx` — 15 new tests for rename and delete

## Critical (Must Fix)

- [ ] **Stale closure in `handleDelete` can fail to clear `activeConversationId`** — `src/components/ConversationSidebar.tsx:129-142` — The `handleDelete` callback closes over `activeConversationId` from the render cycle when the callback was created. Because it is defined in `SidebarContent` and `activeConversationId` is a Zustand selector, the `useCallback` dependency array correctly includes it. However, the sequence is: (1) user clicks delete button, which opens the AlertDialog, (2) user clicks "Confirm" in the dialog. Between steps 1 and 2, if `activeConversationId` changes in the store (e.g., the user clicks another conversation while the dialog is open), the `handleDelete` reference passed to `ConversationItem` may still have the old closure. The `handleDelete` closure is recreated when `activeConversationId` changes, but `ConversationItem` captures the `onDelete` prop at the time the delete dialog was opened (step 1). The `handleConfirmDelete` callback (line 275-278) closes over the `onDelete` prop that was passed when the dialog opened, which could reference the stale `activeConversationId`.

  **Suggested fix**: Read `activeConversationId` directly from the Zustand store inside the `handleDelete` callback rather than relying on the closure:

  ```tsx
  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteConversation(id)
        // Read current active ID from store, not from closure
        if (useAppStore.getState().activeConversationId === id) {
          setActiveConversationId(null)
        }
      } catch (err) {
        console.error('[Sidebar] Failed to delete conversation:', err)
      }
    },
    [setActiveConversationId],
  )
  ```

  This removes `activeConversationId` from the dependency array entirely and reads the latest value at execution time. This is safe because `handleDelete` is an event handler, not a render-time read.

## Warnings (Should Fix)

- [ ] **Confirm rename button triggers double-write via `onBlur`** — `src/components/ConversationSidebar.tsx:292-298` — When the user clicks the "Confirm rename" (check icon) button, the input's `onBlur` fires first (because focus leaves the input), calling `confirmRename()`. Then the button's `onClick` fires, calling `confirmRename()` again. The second call is harmless because `setIsRenaming(false)` has already run and the component re-renders to the non-editing state, but it still triggers a redundant `updateConversation` write to Dexie. The cancel button correctly uses `onMouseDown` with `preventDefault` to avoid this problem. Apply the same pattern to the confirm button:

  ```tsx
  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6 shrink-0"
    onMouseDown={(e) => e.preventDefault()}
    onClick={confirmRename}
    aria-label="Confirm rename"
  >
  ```

  Alternatively, add a guard in `confirmRename` to no-op if `isRenaming` is already false (though this is trickier with closures).

- [ ] **`generateTitle` does not collapse multiple consecutive spaces** — `src/lib/utils.ts:14` — The regex `\n+` replaces one or more newlines with a single space, but the input `"Hello\n\n\nworld"` produces `"Hello   world"` (three spaces). The test at line 114-119 of `utils.test.ts` asserts `"Hello world this is a short message"` which actually passes because the input `"Hello\n\n\nworld this is a short message"` produces `"Hello world this is a short message"` -- three consecutive spaces are preserved. This is a minor UX issue in titles. Consider changing the replacement to collapse whitespace: `text.trim().replace(/\s+/g, ' ')`.

- [ ] **No test coverage for model config restore on conversation switch** — `src/App.tsx:63-77` — The `useEffect` that restores `modelConfig` from the conversation record when `activeConversationId` changes is a key Phase 9 feature but has no dedicated test. Consider adding an integration test that verifies: create a conversation with specific model selections, switch to it, and assert that `useAppStore.getState().selectedModels` reflects the conversation's `modelConfig`.

- [ ] **`conversation.id!` non-null assertion** — `src/components/ConversationSidebar.tsx:222` — The line `const id = conversation.id!` uses a non-null assertion on the Dexie auto-generated `id`. While Dexie always assigns an `id` after `add()`, the TypeScript type declares `id` as optional (common Dexie pattern). This assertion is safe at runtime because the conversation comes from a Dexie query (which always returns records with IDs), but if the `Conversation` type ever changes or the component is used with an unsaved record, this will throw. Consider either guarding with an early return (`if (conversation.id === undefined) return null`) or documenting why the assertion is safe.

## Suggestions (Consider)

- [ ] **Keyboard accessibility for rename/delete action buttons** — The hover-reveal pattern (`opacity-0 group-hover:opacity-100`) means rename and delete buttons are invisible and unreachable via keyboard on desktop. Users tabbing through conversation items will tab to the hidden buttons but cannot see them. Consider adding `focus-within:opacity-100` to the action button container so they become visible when any button inside receives focus:

  ```tsx
  <div className="... opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
  ```

- [ ] **Each `ConversationItem` mounts its own `AlertDialog`** — Each conversation item in the list mounts a full `AlertDialog` component (portal + overlay) in the DOM, even when the dialog is closed. For a sidebar with dozens of conversations, this adds many hidden portal elements. Consider lifting the delete confirmation dialog to the `SidebarContent` level with a single `AlertDialog` controlled by a `deleteTargetId` state, so only one dialog exists regardless of conversation count.

- [ ] **`handleRename` double-trims** — `src/components/ConversationSidebar.tsx:144-152` — The `handleRename` callback trims the title, but `confirmRename` (line 244-250) already trims before calling `onRename`. The redundant trim is harmless but adds unnecessary complexity. Consider removing the trim from `handleRename` since the caller already guarantees a trimmed, non-empty value.

- [ ] **Missing test for rename via the confirm (check) button** — The tests cover Enter, Escape, blur, and cancel button. There is no test that clicks the check icon button to confirm a rename. While this is functionally equivalent to blur (due to the double-fire issue noted above), it would be good to have explicit coverage for the confirm button's intended interaction path.

## Convention Compliance

- **Import aliases**: All imports use `@/` aliases. Compliant.
- **shadcn/ui**: AlertDialog installed via CLI into `src/components/ui/`. Not hand-edited. Compliant.
- **Tailwind tokens**: All styling uses semantic tokens (`bg-background`, `text-foreground`, `bg-accent`, etc.). No raw colors. Compliant.
- **Data layer**: `deleteConversation` and `updateConversation` imported from `@/lib/db`. Direct `db` access only for `useLiveQuery`. Compliant.
- **Zustand selectors**: All store reads use granular selectors (`(s) => s.activeConversationId`). Compliant.
- **Testing**: Tests co-located with source. Uses `fake-indexeddb/auto`, `fireEvent` for pointer-events bypass, `within(aside)` scoping for desktop variant, `ResizeObserverStub` polyfill. All follow established conventions from `CONVENTIONS.md`.
- **Testing with Radix overlays**: Uses `{ hidden: true }` for `getByRole` queries inside the desktop aside. Compliant with the convention.
- **Error handling**: Both `handleDelete` and `handleRename` wrap Dexie operations in try/catch with `console.error`. Consistent with the codebase pattern.
- **Pure function extraction**: `generateTitle` extracted to `src/lib/utils.ts` with comprehensive unit tests. Good adherence to the pattern of keeping pure functions testable in isolation.

## Patterns to Document

- [ ] **Inline edit pattern for sidebar items**: The rename flow (pencil button enters edit mode, Enter/blur confirms, Escape/X cancels, `onMouseDown` `preventDefault` on cancel to prevent blur-before-cancel race) is a reusable pattern worth documenting if similar inline editing appears elsewhere (e.g., editable model labels, custom prompt names).

- [ ] **AlertDialog for destructive actions**: The pattern of using Radix `AlertDialog` with a controlled `open` state, destructive variant on the action button, and `stopPropagation` on the trigger to prevent parent click handlers from firing. This ensures accessible, keyboard-navigable confirmations with proper focus trapping.
