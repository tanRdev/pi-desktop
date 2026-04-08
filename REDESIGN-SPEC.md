# PiDesk → Cursor 3 Visual Redesign Spec

Reference screenshot: Cursor 3 (the AI code editor app).

This document is the single source of truth for making PiDesk match that screenshot exactly. Every difference is catalogued with the current PiDesk code reference, the target Cursor 3 behavior, and the precise change required.

---

## 1. Window Background — Vibrancy (macOS Native)

**Current PiDesk**
`window-config.ts:31-33` — Already correctly configured:

```ts
transparent: true,
vibrancy: "under-window",
visualEffectState: "active",
backgroundColor: "#00000000",
```

**Note:** Ensure the root `<div>` in `workspace-shell.tsx` does NOT have `bg-[#0a0a0a]` on the outermost shell wrapper (that would block the vibrancy from showing through). The sidebar and main content areas use semi-transparent backgrounds (`bg-[#0c0c0c]`, `bg-[#141414]/95`) which correctly let vibrancy bleed through at the edges.

---

## 2. Title Bar — Remove Global Horizontal Bar

**Current PiDesk**
`workspace-shell.tsx:239-243` — `<TitleBar>` renders a `h-9 bg-[#0c0c0c] border-b` spanning the full window width above everything, showing "zsh" text on the left and three icon buttons (search, expand, close) on the right.

**Target (OpenCode)**
No horizontal title bar spans the full window width. The macOS traffic lights appear at the very top-left as native window chrome, and the sidebar content (New Agent button) starts immediately below the traffic light area. The draggable region is integrated into the top of the sidebar itself.

**Required change**
Remove the `<TitleBar>` component from `workspace-shell.tsx`. Instead, add `-webkit-app-region: drag` to the top portion of the left rail (approximately the top 44px). The search and window-control buttons that currently live in TitleBar should either be removed or relocated to the title bar area of the right panel.

Specifically:

- Delete `<TitleBar ... />` from `workspace-shell.tsx:239-243`
- Add `data-drag-region="true"` to a 44px `pt-safe` strip at the top of `left-rail.tsx` (for macOS traffic lights clearance)
- Delete `title-bar.tsx` if no longer referenced, or repurpose it as a panel-level header for the right context surface

---

## 3. Sidebar Width

**Current PiDesk**
`workspace-shell.tsx:22` — `const SIDEBAR_WIDTH = 280`
`left-rail.tsx:18` — `export const LEFT_RAIL_WIDTH = 280`

**Target (OpenCode)**
The sidebar is narrower, approximately **220px**.

**Required change**
Change both constants from `280` to `220`:

```ts
// workspace-shell.tsx:22
const SIDEBAR_WIDTH = 220;

// left-rail.tsx:18
export const LEFT_RAIL_WIDTH = 220;
```

Also update the resize constraint in `left-rail.tsx:102`:

```ts
const newWidth = Math.max(160, Math.min(320, e.clientX));
```

---

## 4. Sidebar Background Color

**Current PiDesk**
`left-rail.tsx:206` — `bg-[#0c0c0c]`

**Target (OpenCode)**
The sidebar is visibly darker than `#0c0c0c` but distinct from the main area. Measured approximation: **`#111111`** (slightly lighter than the `#0a0a0a` main bg, which matches a Cursor-style "one step up" surface).

**Required change**

```tsx
// left-rail.tsx:206
className = "... bg-[#111111] ...";
```

---

## 5. "New Agent" Button — Add Keyboard Shortcut

**Current PiDesk**
`left-rail.tsx:214-227` — The New Agent button renders `<Robot />` icon + "New Agent" text with no keyboard shortcut hint.

**Target (OpenCode)**
The button shows "New Agent" on the left and `⌘N` as a right-aligned shortcut badge. The shortcut is rendered in `text-white/30` at the far right.

**Required change**

```tsx
// left-rail.tsx – New Agent button interior
<Robot className="size-4 text-white/50" weight="regular" />
<span className="flex-1">New Agent</span>
{/* Add this: */}
<span className="ml-auto text-[11px] text-white/30 font-normal tracking-wide">⌘N</span>
```

---

## 6. "New Agent" Button — Change Icon

**Current PiDesk**
`left-rail.tsx:224` — `<Robot className="size-4 text-white/50" weight="regular" />`

**Target (OpenCode)**
The icon is a navigation/compass-style icon — visually it resembles `NavigationArrow` or a triangular directional shape (a stylized agent "pointer"). It is NOT a robot head.

**Required change**
Replace `Robot` with `NavigationArrow` from `@phosphor-icons/react`. (`NavigationArrow` is not yet in `icons.tsx` — add it per Item 7's consolidated icon additions):

```tsx
import {
  FolderPlus,
  Gear,
  NavigationArrow,
  Plus,
  Stack,
  SquaresFour,
  User,
} from "@/components/ui/icons";
// ...
<NavigationArrow className="size-4 text-white/50" weight="fill" />;
```

---

## 7. "Marketplace" Icon

**Current PiDesk**
`left-rail.tsx:241` — `<Storefront className="size-4" weight="regular" />`
**Bug:** `Storefront` is imported in `left-rail.tsx` but is NOT in `icons.tsx` — this is an existing LSP error (`Module '"@/components/ui/icons"' has no exported member 'Storefront'`).

**Target (OpenCode)**
Uses a grid/apps-like icon that looks like `SquaresFour` (four small squares in a 2×2 grid) — the standard "marketplace/apps" metaphor.

**Required change**

1. Add `SquaresFour` and `Faders` and `Microphone` and `NavigationArrow` to `icons.tsx`:

```tsx
// icons.tsx — add to the import block:
import {
  // ...existing...
  Faders,
  Microphone,
  NavigationArrow,
  SquaresFour,
} from "@phosphor-icons/react";

// Add to the re-export block:
export { Faders, Microphone, NavigationArrow, SquaresFour };
```

2. Replace `Storefront` with `SquaresFour` in `left-rail.tsx:241`:

```tsx
import { ..., SquaresFour, ... } from "@/components/ui/icons";
// ...
<SquaresFour className="size-4" weight="regular" />
```

---

## 8. Remove "Projects" Section Header

**Current PiDesk**
`left-rail.tsx:249-272` — A section header row renders above the repository list with `Stack` icon, "PROJECTS" label, and a `Plus` button to add a repo.

**Target (OpenCode)**
There is NO section header between the Marketplace button and the workspace items. The workspace list starts immediately after a thin divider.

**Required change**
Delete the entire "Header - Cursor minimal" block (`left-rail.tsx:249-272`):

```tsx
{
  /* DELETE THIS ENTIRE BLOCK: */
}
<div className="flex items-center justify-between px-3 py-2 bg-transparent">
  ...Stack icon, "Projects" label, Plus button...
</div>;
```

Move the "Add repository" (`+`) button functionality elsewhere (e.g. expose it only from the "Open Workspace" button, or as a context-menu action on hover).

---

## 9. Workspace Items — "No agents yet" Subtext

**Current PiDesk**
`left-rail.tsx:344-378` — Each repository renders a button with `ProjectAvatar` + name. Worktrees are a nested collapsible list inside each repository. An empty worktree shows "No threads" inside `worktree-section.tsx:138`.

**Target (OpenCode)**
Each workspace item shows the workspace name on the first line and `— No agents yet` (when no active agents/threads) as a second line in `text-white/30`. There is no collapse/expand toggle — the subtext is always visible as a static descriptor.

**Required change**
Inside the repository button in `left-rail.tsx`, add a subtitle row directly below the name:

```tsx
<span className="min-w-0 flex-1">
  <span
    className={cn(
      "block truncate text-[13px] font-medium leading-tight",
      isActive ? "text-white/90" : "text-white/50",
    )}
  >
    {repositoryName}
  </span>
  {/* Add this: */}
  <span className="flex items-center gap-1 text-[11px] text-white/25 leading-tight mt-0.5">
    <Minus className="size-2.5 shrink-0" weight="bold" />
    <span>No agents yet</span>
  </span>
</span>
```

This subtitle should show the actual thread/agent count when agents exist (e.g. "2 agents") and fall back to "No agents yet" when empty.

Import `Minus` from `@phosphor-icons/react`.

---

## 10. "Open Workspace" — Change Icon

**Current PiDesk**
`left-rail.tsx:394` — `<FolderPlus className="size-4" weight="regular" />`

**Target (OpenCode)**
Uses `FolderOpen` (a folder in the open/mouth-up position, without a `+` badge).

**Required change**

```tsx
import { FolderOpen, Gear, ... } from "@/components/ui/icons";
// ...
<FolderOpen className="size-4" weight="regular" />
```

---

## 11. User Avatar — Letter Initial vs. Icon

**Current PiDesk**
`left-rail.tsx:409-413` — `AvatarFallback` renders `<User className="size-4" />` icon with `bg-white/[0.06]` background (nearly invisible).

**Target (OpenCode)**
The avatar is a solid blue filled circle (`#3b82f6` or similar) containing the user's **first letter** ("T" for Tanvi) in white, font-size ~14px, font-weight medium.

**Required change**

```tsx
<AvatarFallback className="bg-[#3b82f6] text-white text-[13px] font-semibold">
  {userName.charAt(0).toUpperCase()}
</AvatarFallback>
```

Remove the `<User>` icon import from this component's usage (it's no longer needed for the fallback). The `size-8` avatar class stays.

---

## 12. User Profile — Add Filter/Sliders Icon Button

**Current PiDesk**
`left-rail.tsx:421-430` — Only one icon button to the right of the user name: the settings gear (`Gear`).

**Target (OpenCode)**
Two icon buttons appear to the right of the user name:

1. A **filter/sliders icon** (appears first, looks like `Faders` from Phosphor Icons)
2. The **settings gear** (appears second)

**Required change**
`Faders` will be added to `icons.tsx` as part of Item 7's consolidated icon additions. Then in `left-rail.tsx`:

```tsx
import { ..., Faders, ... } from "@/components/ui/icons";

// In user profile area — wrap both buttons in a flex container:
<div className="flex items-center gap-1">
  <button
    type="button"
    className="flex size-7 items-center justify-center rounded-md text-white/25 transition-all duration-150 hover:text-white/50 hover:bg-white/[0.03]"
    aria-label="Filter"
    title="Filter"
  >
    <Faders className="size-4" weight="regular" />
  </button>
  <button
    type="button"
    onClick={onOpenSettings}
    className="flex size-7 items-center justify-center rounded-md text-white/25 transition-all duration-150 hover:text-white/50 hover:bg-white/[0.03]"
    aria-label="Settings"
    title="Settings"
  >
    <Gear className="size-4" weight="regular" />
  </button>
</div>
```

Add an optional `onOpenFilter?: () => void` prop to `LeftRailProps`. Wire it as a no-op at minimum.

---

## 13. Prompt Input — Workspace Breadcrumb Header

**Current PiDesk**
`workspace-shell.tsx:316-342` — The floating PromptDock container has no header. The input starts directly.

**Target (OpenCode)**
Above the text area, there is a compact one-line header showing:

- The active workspace name with a chevron-down (dropdown selector): `tanrdev/pm-tooling ▼`
- A terminal/window icon button on the right

This header is inside the floating input container, acting as a context breadcrumb.

**Required change**
Add a header row to the top of `PromptDock` (or to `workspace-shell.tsx` in the container `<div>` wrapping `<PromptDock>`):

```tsx
{
  /* Insert above <PromptDock>: */
}
<div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2">
  <button
    type="button"
    className="flex items-center gap-1.5 text-[12px] text-white/50 hover:text-white/80 transition-colors"
  >
    <span className="font-medium">
      {activeRepository?.name ?? "No workspace"}
    </span>
    <CaretDown className="size-3 text-white/30" />
  </button>
  <button
    type="button"
    className="flex size-6 items-center justify-center rounded text-white/25 hover:text-white/50 hover:bg-white/[0.04] transition-all"
    aria-label="Terminal"
    onClick={onOpenTerminal}
  >
    <Terminal className="size-3.5" weight="regular" />
  </button>
</div>;
```

Pass `activeRepository` and `onOpenTerminal` down through props as needed.

---

## 14. Prompt Input — Send Button Style

**Current PiDesk**
`prompt-dock.tsx:392-413` — Send button is a text label ("Send") with `h-7 rounded-lg px-3 text-xs font-medium bg-accent`.

**Target (OpenCode)**
The send button is a small **circle** with an upward-arrow icon (`ArrowUp`) inside it. No text label. Styled as `rounded-full size-7 bg-white/80 text-black` (or `bg-[#e7e7e7] text-[#0a0a0a]`).

**Required change**

```tsx
// Replace the send Button in prompt-dock.tsx:
<Button
  type="button"
  data-testid="chat-send"
  variant="default"
  size="icon"
  disabled={isPromptExecuting ? false : !canSend}
  onClick={() => void (isPromptExecuting ? onCancelPrompt() : onSend())}
  className={cn(
    "size-7 rounded-full bg-white/80 text-[#0a0a0a] hover:bg-white transition-all",
    isPromptExecuting &&
      "bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/90",
    !isPromptExecuting && !canSend && "opacity-20",
  )}
>
  {isPromptExecuting ? (
    <Square className="size-3 fill-current" />
  ) : (
    <ArrowUp className="size-3.5" weight="bold" />
  )}
</Button>
```

Import `ArrowUp` from `@phosphor-icons/react`.

---

## 15. Prompt Input — Add Microphone Button

**Current PiDesk**
`prompt-dock.tsx:293-308` — Left-side actions contain only "Attach files" (`Paperclip`) and model selector. No microphone.

**Target (OpenCode)**
A microphone icon (`Microphone`) appears on the left of the send button (right-action area), before the send button.

**Required change**
In `prompt-dock.tsx`, inside `<PromptInputActions>` right-side div, add before the send button:

```tsx
<PromptInputAction tooltip="Voice input">
  <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    aria-label="Voice input"
    className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
  >
    <Microphone className={ICON_SIZE_MD} weight="regular" />
  </Button>
</PromptInputAction>
```

Import `Microphone` from `@/components/ui/icons` — it will be available there after the additions in Item 7.

---

## 16. Slash Command Dropdown — Section Headers and Layout

**Current PiDesk**
`prompt-autocomplete.tsx:58-131` — Single flat `<ul>` list of suggestions. All items use the same `Command` icon. No section grouping, no "Show X more" links, no modes section.

**Target (OpenCode)**
The autocomplete dropdown is divided into **three labeled sections**:

| Section      | Icon style                  | "Show more" link |
| ------------ | --------------------------- | ---------------- |
| **Skills**   | Wrench/gear icon per item   | "Show 70 more"   |
| **Commands** | Slash/command icon per item | "Show 20 more"   |
| **Modes**    | Colored status dot per mode | None             |

Each section has a small uppercase section header label (`text-[10px] text-white/30 uppercase tracking-widest px-3 py-1.5`). Items within sections include a short description on the second line.

**Modes** render with colored indicators:

- Ask: green dot `bg-green-500`
- Debug: red/pink X icon `text-red-400`
- Plan: blue grid `text-blue-400`

**Required changes**

1. Update `SlashSuggestion` type in `@pidesk/shared` to include a `category: "skill" | "command" | "mode"` field and an optional `description: string`.

2. Refactor `PromptAutocomplete` to group suggestions by `category` and render each group with a header + "Show more" truncation logic.

3. Add mode-specific colored icons: create a `getModeIcon(name)` helper that returns the appropriate colored indicator.

4. Section header JSX pattern:

```tsx
<div className="px-3 pt-2 pb-1">
  <span className="text-[10px] font-medium text-white/25 uppercase tracking-widest">
    {sectionLabel}
  </span>
</div>
```

5. "Show more" link:

```tsx
{
  hiddenCount > 0 && (
    <button
      type="button"
      className="w-full px-3 py-1.5 text-left text-[11px] text-white/30 hover:text-white/50 transition-colors"
    >
      Show {hiddenCount} more
    </button>
  );
}
```

---

## 17. Main Content Area — Empty State Background

**Current PiDesk**
`workspace-shell.tsx:264-289` — When `hasActiveThread` is false, the main content `<div>` is empty (renders nothing). The area shows the plain `bg-[#0a0a0a]` background.

**Target (OpenCode)**
When no thread is active, the center area is a clean dark surface. The command input is prominent, centered, and visually lifted. There is no empty-state illustration.

**Required change**
This is already handled by the floating PromptDock. No structural change needed beyond making sure the main area `bg` matches: use `bg-[#0d0d0d]` (one step lighter than the root `#0a0a0a`) to create the subtle depth separation.

```tsx
// workspace-shell.tsx:264-270
<main
  className={cn(
    "relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden",
    "bg-[#0d0d0d]"  // was bg-[#0a0a0a]
  )}
>
```

---

## 18. Floating Prompt Container — Styling

**Current PiDesk**
`workspace-shell.tsx:317-318` — Prompt container:

```tsx
className =
  "pointer-events-auto w-full max-w-[720px] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#141414]/95 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl";
```

**Target (OpenCode)**
The prompt container is visually similar but slightly more transparent/glassy. The key observable difference: `max-w-[600px]` (narrower), and slightly less border opacity.

**Required change**

```tsx
className =
  "pointer-events-auto w-full max-w-[600px] overflow-hidden rounded-2xl border border-white/[0.05] bg-[#141414]/90 shadow-[0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-2xl";
```

---

## 19. Title Bar — "zsh" Label Removal

**Current PiDesk**
`title-bar.tsx:90-96` — Shows "zsh" text in the left of the title bar.

**Target (OpenCode)**
No "zsh" label visible anywhere in the application chrome.

**Required change**
Per Item 2 above (removing the TitleBar), this is resolved automatically. If a title bar element is kept, remove the "zsh" text node entirely.

---

## 20. Sidebar Section Divider

**Current PiDesk**
`left-rail.tsx:247` — `<div className="mx-3 h-px bg-white/[0.03]" />`

**Target (OpenCode)**
The visual separator between the top nav items (New Agent, Marketplace) and the workspace list is not a visible divider line but just spacing. The divider color in OpenCode appears to be effectively invisible (`opacity ~0.02`).

**Required change**
Keep the divider but reduce opacity further:

```tsx
<div className="mx-3 h-px bg-white/[0.02]" />
```

---

## 21. Right Panel — Code Editor Integration

**Current PiDesk**
`workspace-shell.tsx:292-313` — Right context panel renders `WorkspaceActivityPanel` or `WorkspaceSurfacePanel` at `w-[400px]` when `selectedSurfaceKey !== null`. It's hidden by default.

**Target (OpenCode)**
The right side of the window shows what appears to be an integrated code editor with:

- A tab bar showing open files (e.g. `page.tsx M`)
- A file tree breadcrumb (e.g. `apps > web > app > page.tsx`)
- Toolbar icons (git, layout, search, etc.)
- Monaco-style code view with line numbers and syntax highlighting
- The code editor is always visible as a persistent right panel (not conditional)

**Required change**
This is the largest structural change. Options:

1. **Always show the right surface panel** — remove the `selectedSurfaceKey !== null` condition and default to showing the code editor (or file tree) on startup.
2. **Persistent panel width** — change from conditionally-rendered 400px to a permanent panel that can be collapsed but defaults to `w-[400px]`.

Minimum change to match screenshot:

```tsx
// workspace-shell.tsx:292 — remove the conditional wrapper
// Change:
{selectedSurfaceKey !== null && (
  <div className="min-h-0 w-[400px] ...">...</div>
)}
// To:
<div className={cn(
  "min-h-0 w-[400px] shrink-0 overflow-hidden border-l border-white/[0.03] bg-[#0c0c0c]",
  "transition-all duration-[var(--duration-slow)]",
)}>
  {/* Render a default file/editor view always */}
  <WorkspaceSurfacePanel ... />
</div>
```

---

## 22. Font Stack — Remove Google Fonts

**Current PiDesk**
`index.html:7-12` — Loads Space Grotesk + JetBrains Mono from Google Fonts. These are legacy fonts not used in the current design system.

**Target (OpenCode)**
Uses only the variable fonts loaded via `@fontsource-variable` (Geist, Manrope, Source Code Pro). No Google Fonts.

**Required change**
Remove the two `<link>` tags for Google Fonts from `apps/desktop/src/renderer/index.html`:

```html
<!-- DELETE THESE: -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;700&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

---

## 23. Sidebar — Workspace Item Tap Target Height

**Current PiDesk**
`left-rail.tsx:321` — Repository button: `px-2.5 py-2` → approximately 36px tap target.

**Target (OpenCode)**
Workspace items in OpenCode appear taller (~44px per item) to accommodate the two-line name + subtext layout.

**Required change**
Change to `px-2.5 py-2.5` to accommodate the two-line label (name + "No agents yet"):

```tsx
className={cn(
  "group flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left transition-all duration-150",
  ...
)}
```

---

## Summary Table

| #   | Section                                               | File                                       | Change Type                                           |
| --- | ----------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| 0   | Fix `Storefront` missing from icons + add 4 new icons | `icons.tsx`                                | Bug fix + icon additions                              |
| 1   | Window vibrancy — already correct                     | `window-config.ts`                         | No change needed (verify root shell has no opaque bg) |
| 2   | Remove horizontal title bar                           | `workspace-shell.tsx`, `title-bar.tsx`     | Remove `<TitleBar>`, add drag region to sidebar       |
| 3   | Sidebar width 280→220px                               | `workspace-shell.tsx`, `left-rail.tsx`     | Update constants                                      |
| 4   | Sidebar bg `#0c0c0c`→`#111111`                        | `left-rail.tsx`                            | Update class                                          |
| 5   | New Agent — add ⌘N shortcut                           | `left-rail.tsx`                            | Add shortcut span                                     |
| 6   | New Agent — change icon Robot→NavigationArrow         | `left-rail.tsx`, `icons.tsx`               | Swap icon                                             |
| 7   | Marketplace icon Storefront→SquaresFour               | `left-rail.tsx`, `icons.tsx`               | Swap icon + fix bug                                   |
| 8   | Remove "Projects" section header                      | `left-rail.tsx`                            | Delete block                                          |
| 9   | Workspace items — "No agents yet" subtext             | `left-rail.tsx`                            | Add subtitle row                                      |
| 10  | Open Workspace icon FolderPlus→FolderOpen             | `left-rail.tsx`                            | Swap icon (`FolderOpen` already in icons.tsx)         |
| 11  | Avatar fallback User icon→letter initial              | `left-rail.tsx`                            | Update AvatarFallback                                 |
| 12  | Avatar bg transparent→solid blue                      | `left-rail.tsx`                            | Update bg class                                       |
| 13  | Add Faders filter icon button                         | `left-rail.tsx`, `icons.tsx`               | Add button                                            |
| 14  | Prompt — add workspace breadcrumb header              | `workspace-shell.tsx` or `prompt-dock.tsx` | Add header row                                        |
| 15  | Send button text→circular ArrowUp icon                | `prompt-dock.tsx`                          | Restyle button                                        |
| 16  | Add Microphone button                                 | `prompt-dock.tsx`                          | Add button                                            |
| 17  | Autocomplete — grouped sections + modes               | `prompt-autocomplete.tsx`, shared types    | Refactor component                                    |
| 18  | Main area bg `#0a0a0a`→`#0d0d0d`                      | `workspace-shell.tsx`                      | Update class                                          |
| 19  | Prompt container narrower 720→600px                   | `workspace-shell.tsx`                      | Update max-w                                          |
| 20  | Remove "zsh" label                                    | `title-bar.tsx`                            | Delete (n/a if item 2 done)                           |
| 21  | Softer section divider                                | `left-rail.tsx`                            | Update opacity                                        |
| 22  | Always-visible right panel                            | `workspace-shell.tsx`                      | Remove conditional                                    |
| 23  | Remove Google Fonts                                   | `index.html`                               | Delete link tags                                      |
| 24  | Workspace item tap target height                      | `left-rail.tsx`                            | Adjust padding                                        |

---

## Implementation Order

1. **Item 0** — Fix `icons.tsx` bug (`Storefront` missing) + add `NavigationArrow`, `SquaresFour`, `Faders`, `Microphone`. This unblocks items 6, 7, 13, 16.
2. **Items 2, 23** — Remove TitleBar and Google Fonts (layout-clearing, no regressions)
3. **Items 3, 4, 18, 19, 21** — Dimension and color updates (fast, low-risk)
4. **Items 5, 6, 7, 8, 10** — Icon swaps and section header removal (isolated)
5. **Items 9, 24** — Workspace item subtext (visual polish)
6. **Items 11, 12, 13** — User profile avatar and filter button
7. **Item 1** — Vibrancy: already wired. Verify root shell div has no opaque `bg-[#0a0a0a]` blocking it.
8. **Items 14, 15, 16** — Prompt input header and button restyling
9. **Item 17** — Autocomplete refactor (largest change, needs shared type updates)
10. **Item 22** — Always-visible right panel (layout change, verify with tests)
