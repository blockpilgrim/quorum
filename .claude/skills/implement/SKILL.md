---
name: implement
description: Run the full build → test → review → verify workflow for a feature or task
argument-hint: <task description>
---

Run the full implementation workflow for: $ARGUMENTS

Follow these steps in order. Do not skip steps.

## Step 1 — Build

Use the **builder** subagent to implement the feature: $ARGUMENTS

Wait for it to complete and note its summary.

## Step 2 — Test

Use the **test-writer** subagent to write tests for the implementation from Step 1.

Wait for it to complete and note its coverage summary.

## Step 3 — Code Review

Use the **code-reviewer** subagent to review the changes made in Steps 1 and 2.

Wait for it to complete. Read the full review document it created.

## Step 4 — Address Review Feedback

Address the review findings yourself (do not use a subagent for this step):
1. Fix all **Critical** items
2. Fix all **Warning** items
3. Consider **Suggestion** items and fix where appropriate
4. Commit the fixes

## Step 5 — Documentation Verification

Use the **doc-verifier** subagent to verify documentation matches the implementation.

Wait for it to complete. Read the verification report.

## Step 6 — Address Doc Issues

Fix any **Critical** documentation discrepancies yourself. Commit the changes.

## Step 7 — Finalize

1. Execute the **Compound Engineering Protocol**:
   - Review CONVENTIONS.md
   - Add any new patterns that emerged during implementation
   - Document any anti-patterns discovered
   - Update docs/DECISIONS.md if significant architectural decisions were made
   - Commit any convention updates

2. **Update progress** in `docs/IMPLEMENTATION-PLAN.md` — mark the completed phase as done (`- [x]`)

3. Provide a **final summary** covering:
   - What was built
   - Test coverage
   - Review findings and how they were resolved
   - Documentation status
   - Convention updates made
   - Files created or modified
   - Any remaining items or known issues
