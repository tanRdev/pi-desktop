# Obsidian Command Design Update Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the visual design of PiDesk to follow the "Obsidian Command" aesthetic: high-density, monochromatic, and technical, with zero border radius and sharp background shifts.

**Architecture:** Use Tailwind CSS for styling with `cn()` for class merging. Enforce 0px border radius across all components. Replace shadows with background shifts or high-contrast borders. Use Space Grotesk for headlines and JetBrains Mono for technical text.

**Tech Stack:** React, Tailwind CSS, Monaco Editor, xterm.js, Lucide Icons (as Hugeicons/icons).

---

## Chunk 1: Canvas & Grid

### Task 1: Update Canvas Container snap preview and zoom controls

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/canvas/canvas-container.tsx`

- [ ] **Step 1: Remove rounding from snap preview**
  Modify line 338: Change `rounded-lg` to `rounded-none`.
- [ ] **Step 2: Update zoom controls styling**
  Modify line 356: Change `rounded-lg` to `rounded-none`, remove `shadow-lg`, ensure `bg-surface-1/90`.
  Modify lines 360, 384: Change `rounded-md` to `rounded-none`.
- [ ] **Step 3: Update minimized windows bar buttons**
  Modify line 434: Change `rounded` to `rounded-none`, remove `shadow`.

### Task 2: Update Canvas Grid pattern

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/canvas/canvas-grid.tsx`

- [ ] **Step 1: Update grid gradient to be sharper and monochromatic**
  Modify line 10: Change to a sharper dot pattern.
  ```typescript
  backgroundImage:
    "radial-gradient(circle, rgba(255,255,255,0.1) 0.5px, transparent 0.5px)",
  ```

---

## Chunk 2: Window Chrome & Routing

### Task 3: Revamp Window Chrome for Obsidian Command aesthetic

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/canvas/window-chrome.tsx`

- [ ] **Step 1: Update window container rounding and shadows**
  Modify line 91: Ensure no `rounded-*` classes.
  Modify line 96: Change `shadow-lg` to `border-border-hover bg-surface-1`.
- [ ] **Step 2: Transform traffic lights into square technical controls**
  Modify lines 140, 171, 201: Change `rounded-full` to `rounded-none`.
- [ ] **Step 3: Update title bar font and alignment**
  Modify line 258: Add `font-sans font-medium tracking-tight` (for Space Grotesk).
- [ ] **Step 4: Remove rounding from title input**
  Modify line 248: Change `rounded-sm` to `rounded-none`.
- [ ] **Step 5: Update minimized window state**
  Modify line 401: Change `rounded-sm` to `rounded-none`, remove `hover:shadow-sm`.
  Modify line 416: Change `rounded-sm` to `rounded-none`.

### Task 4: Update Content Router animations

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/canvas/window-content-router.tsx`

- [ ] **Step 1: Change window entering animations to be sharper**
  Update all occurrences of `animate-[window-enter_300ms_cubic-bezier(0.23,1,0.32,1)_forwards]` to a more linear or glitchy animation if available, or just use `duration-150` and `linear`.
  ```typescript
  className="h-full animate-[window-enter_150ms_linear_forwards] motion-reduce:animate-none"
  ```

---

## Chunk 3: Core UI (File Viewer, Terminal, Editor, Code Block)

### Task 5: Update File Viewer buttons and rounding

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/ui/file-viewer.tsx`

- [ ] **Step 1: Remove rounding from header buttons**
  Modify lines 167, 182: Change `rounded` to `rounded-none`.
- [ ] **Step 2: Remove rounding from empty state containers**
  Modify lines 228, 271, 334: Change `rounded-xl` to `rounded-none`.
- [ ] **Step 3: Remove rounding from images**
  Modify line 298: Change `rounded-lg` to `rounded-none`. (Wait, this is in markdown.tsx for images? No, line 298 in file-viewer is different).
  Actually, check `file-viewer.tsx` around line 253 (img tag) and line 298 (large file notice).
  Modify line 253: Remove `rounded-lg` if present (it's not, but check `markdown.tsx`).

### Task 6: Update Terminal theme and error states

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/ui/terminal.tsx`

- [ ] **Step 1: Refine terminal theme colors to match monochromatic palette**
  Modify line 37: Ensure background is `#131313` or `#0e0e0e`.
- [ ] **Step 2: Update error state boxes to be sharp**
  Modify line 165: Change `rounded` to `rounded-none`.

### Task 7: Update Code Editor options

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/ui/code-editor.tsx`

- [ ] **Step 1: Ensure JetBrains Mono and no rounding in Monaco**
  Modify line 126: Ensure `minimap: { enabled: false }`.
  Modify line 185: Change `rounded-full` to `rounded-none` for the loading spinner (or use a square).

### Task 8: Update Code Block containers and overlays

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/ui/code-block.tsx`

- [ ] **Step 1: Remove rounding from code containers**
  Modify line 231: Ensure no `rounded-*` classes.
- [ ] **Step 2: Update loading/error overlays**
  Modify lines 240, 261: Ensure no rounding.

---

## Chunk 4: Content UI (Markdown, Reasoning, Streaming, Thinking, Tool, Chain of Thought)

### Task 9: Update Markdown styles for technical look

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/ui/markdown.tsx`

- [ ] **Step 1: Update headings to use Space Grotesk**
  Modify lines 50, 60, 70, 80: Add `font-sans tracking-tight`.
- [ ] **Step 2: Remove rounding from inline code and images**
  Modify line 213: Change `rounded` to `rounded-none`.
  Modify line 298: Change `rounded-lg` to `rounded-none`, remove `shadow-sm`, `hover:shadow-md`.
- [ ] **Step 3: Update table headers and rounding**
  Modify line 250: Ensure no rounding.
- [ ] **Step 4: Update bullet points to technical markers**
  Modify line 166: Change `list-disc` to `list-none`.
  Modify line 185: Add a prefix like `::` or a square dot.
  ```typescript
  li: function LiComponent({ children, ...props }) {
    return (
      <li className="my-1.5 pl-1 flex items-start gap-2" {...props}>
        <span className="text-muted-foreground mt-1.5 size-1 bg-current shrink-0" />
        <div>{children}</div>
      </li>
    );
  },
  ```

### Task 10: Update Reasoning expansion container

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/ui/reasoning.tsx`

- [ ] **Step 1: Remove rounding and use background shifts**
  Modify line 162: Ensure no rounding.
  Modify line 176: Use `bg-surface-2` for the reasoning area instead of just text styles.

### Task 11: Update Response Stream animations

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/ui/response-stream.tsx`

- [ ] **Step 1: Update typewriter/fade animations to feel more mechanical**
  Modify line 336: Change `translateY(2px)` to `scaleY(0.95)` or something sharper.
  Modify line 359: Change `border-radius: 50%` to `border-radius: 0`.

### Task 12: Update Thinking Bar styling

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/ui/thinking-bar.tsx`

- [ ] **Step 1: Remove rounding and update shimmer**
  Modify line 23: Ensure no rounding.
  Modify line 51: Ensure no rounding on the stop button.

### Task 13: Update Tool badges and icons

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/ui/tool.tsx`

- [ ] **Step 1: Remove rounding from tool container and badges**
  Modify line 165: Change `rounded-lg` to `rounded-none`.
  Modify line 176: Change `rounded-b-none` to `rounded-none`.
  Modify line 89: Change `rounded-full` to `rounded-none`.
- [ ] **Step 2: Remove rounding from input/output boxes**
  Modify line 209, 225, 236: Change `rounded` to `rounded-none`.

### Task 14: Update Chain of Thought lines and markers

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/ui/chain-of-thought.tsx`

- [ ] **Step 1: Remove rounding from trigger and content**
  Modify line 48: Ensure no rounding (it's mostly `scale-95`).
- [ ] **Step 2: Update connector lines to be sharp**
  Modify line 115, 172: Ensure `w-px` and no rounding.

---

## Verification

- [ ] **Run type check**
  Run: `npm run typecheck`
  Expected: Success

- [ ] **Visual Verification**
  - Check all components for 0px border radius.
  - Verify monochromatic palette (#131313, #ffffff, #0e0e0e, #353535, #474747).
  - Verify JetBrains Mono and Space Grotesk usage.
