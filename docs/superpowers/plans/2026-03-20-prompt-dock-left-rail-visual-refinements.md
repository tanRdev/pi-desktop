# Prompt Dock + Left Rail Visual Refinements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the integrated prompt dock and left workspace chrome so the composer feels anchored to the chat surface, hides cleanly outside text-thread mode, uses a compact horizontal suggestion row, and tightens left-rail/sidebar typography without visual overlap.

**Architecture:** Keep the slice fully local to the workspace prompt shell and left navigation surfaces. Use class-level layout refinements in the existing components, preserve title-bar and launcher behavior, and lock the requested styling/visibility behaviors with focused source-based tests.

**Tech Stack:** React, TypeScript, Tailwind utility classes, Vitest source-based integration tests

---

## File map

- Modify: `apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx`
  - Narrow the visual dock container so it reads as the composer only, not a full-width footer band.
  - Refine the hide/show animation so the prompt retracts like a drawer when no text thread is active.
  - Keep the dock overlaying the canvas grid rather than reserving excess outer width.
- Modify: `packages/ui/src/components/ui/prompt-input.tsx`
  - Tighten the shared prompt shell frame if needed so the dock chrome stays compact after the width change.
  - Preserve focus, autosize, submit, and disabled behavior.
- Modify: `apps/desktop/src/renderer/src/components/ui/prompt-suggestion.tsx`
  - Convert the suggestion group into a single horizontal scroller.
  - Reduce card height/density so the row feels secondary to the composer.
- Modify: `apps/desktop/src/renderer/src/components/workspace/left-rail.tsx`
  - Reduce excessive tracking in `PROJECTS`, rail labels, and related chrome.
  - Keep navigation structure intact while tightening label density.
- Modify: `apps/desktop/src/renderer/src/components/workspace/left-sidebar.tsx`
  - Remove the visual overlap with the fixed left rail by separating sidebar layout width from rail offset.
  - Tighten sidebar header/search/meta typography where this slice already owns it.
- Modify: `tests/integration/apps-desktop/workspace-shell-ui.spec.ts`
  - Assert compact overlay dock and hidden-state animation hooks.
- Modify: `tests/integration/apps-desktop/left-rail.spec.ts`
  - Assert tighter left-rail label tracking hooks.
- Modify: `tests/integration/apps-desktop/design-refinements.spec.ts`
  - Assert compact prompt suggestions, sidebar/rail spacing, and no left-sidebar overlap with the rail.

## Constraints and repo notes

- The requested source files are already dirty in git, so implementation must preserve unrelated user changes and edit only the requested slice.
- Do not change `title-bar.tsx`, launcher behavior, or unrelated workspace logic.
- Prefer readable class changes over structural churn.
- Keep tests source-based and focused on requested class/behavior hooks.

## Chunk 1: Prompt dock refinement

### Task 1: Compact the dock shell and preserve overlay behavior

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx`
- Modify: `packages/ui/src/components/ui/prompt-input.tsx`
- Test: `tests/integration/apps-desktop/workspace-shell-ui.spec.ts`

- [ ] **Step 1: Write/update the failing source-based assertions**

Add assertions that `prompt-dock.tsx` uses a narrower composer-width container, keeps the autocomplete escaped below the shell, and applies a retracting hidden-state class sequence rather than a full-width always-visible dock feel.

- [ ] **Step 2: Run the focused test to confirm the current source fails the new assertions**

Run: `rtk bun vitest tests/integration/apps-desktop/workspace-shell-ui.spec.ts`
Expected: FAIL on the new dock width / hide animation assertions.

- [ ] **Step 3: Implement the minimal dock/input refinement**

Update the dock wrapper to:
- use a tighter `max-w-*`/composer-sized inner container,
- keep the dock visually floating above the grid,
- switch the hidden state to a drawer-like retract animation,
- keep `PromptAutocomplete` absolutely positioned under the dock,
- avoid changing send/model logic.

Update the shared prompt input shell only as needed so the compact dock still looks intentional and readable.

- [ ] **Step 4: Re-run the focused test to verify it passes**

Run: `rtk bun vitest tests/integration/apps-desktop/workspace-shell-ui.spec.ts`
Expected: PASS.

## Chunk 2: Prompt suggestion row refinement

### Task 2: Convert prompt suggestions to a single horizontal scroller

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/ui/prompt-suggestion.tsx`
- Modify: `apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx`
- Test: `tests/integration/apps-desktop/design-refinements.spec.ts`

- [ ] **Step 1: Write/update the failing source-based assertions**

Add assertions that the suggestion group is one horizontally scrollable row and each suggestion uses a lower-height compact layout.

- [ ] **Step 2: Run the focused test to verify the current source fails**

Run: `rtk bun vitest tests/integration/apps-desktop/design-refinements.spec.ts`
Expected: FAIL on the new prompt suggestion assertions.

- [ ] **Step 3: Implement the minimal suggestion-row refinement**

Adjust the suggestion group to a single-row `overflow-x-auto` container and tighten suggestion card padding/text sizing so the row stays short and scan-friendly.

- [ ] **Step 4: Re-run the focused test to verify it passes**

Run: `rtk bun vitest tests/integration/apps-desktop/design-refinements.spec.ts`
Expected: PASS for the new suggestion assertions.

## Chunk 3: Left rail and sidebar refinement

### Task 3: Tighten sidebar typography and prevent rail/sidebar overlap

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/workspace/left-rail.tsx`
- Modify: `apps/desktop/src/renderer/src/components/workspace/left-sidebar.tsx`
- Test: `tests/integration/apps-desktop/left-rail.spec.ts`
- Test: `tests/integration/apps-desktop/design-refinements.spec.ts`

- [ ] **Step 1: Write/update the failing source-based assertions**

Add assertions that:
- left-rail labels and `PROJECTS` use reduced tracking,
- left-sidebar header chrome uses tighter tracking,
- the sidebar layout no longer combines rail width into the sidebar content shell in a way that visually overlaps the rail.

- [ ] **Step 2: Run the focused tests to verify the current source fails**

Run: `rtk bun vitest tests/integration/apps-desktop/left-rail.spec.ts tests/integration/apps-desktop/design-refinements.spec.ts`
Expected: FAIL on the new rail/sidebar assertions.

- [ ] **Step 3: Implement the minimal rail/sidebar refinement**

Refine left-rail labels and sidebar chrome to reduce excessive letter spacing, then separate the sidebar width from the fixed rail offset so the sidebar starts beside the rail instead of visually under it.

- [ ] **Step 4: Re-run the focused tests to verify they pass**

Run: `rtk bun vitest tests/integration/apps-desktop/left-rail.spec.ts tests/integration/apps-desktop/design-refinements.spec.ts`
Expected: PASS.

## Chunk 4: Final slice verification

### Task 4: Run the full focused verification set and capture handoff notes

**Files:**
- Verify: `tests/integration/apps-desktop/workspace-shell-ui.spec.ts`
- Verify: `tests/integration/apps-desktop/left-rail.spec.ts`
- Verify: `tests/integration/apps-desktop/design-refinements.spec.ts`

- [ ] **Step 1: Run the combined focused verification suite**

Run: `rtk bun vitest tests/integration/apps-desktop/workspace-shell-ui.spec.ts tests/integration/apps-desktop/left-rail.spec.ts tests/integration/apps-desktop/design-refinements.spec.ts`
Expected: PASS.

- [ ] **Step 2: Record coordinating-agent notes in the final handoff**

Report:
- files changed,
- exact commands run,
- pass/fail results,
- any integration notes about dirty pre-existing files or preserved unrelated edits.
