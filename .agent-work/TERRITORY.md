# Parallel Agent Territory Map

Strict ownership to prevent merge conflicts. Agents MUST only edit files inside their owned paths. Shared files are read-only.

## Shared read-only (anyone may read, only owner may edit)
- packages/shared/src/models/** — owned by A6 (IPC/Security) when additions are needed
- packages/shared/src/ipc/channels.ts — owned by A6

## Agents

### A1 - Test & Lint Stabilizer
OWNS:
- apps/desktop/src/renderer/src/components/ui/dialog.spec.tsx
- apps/desktop/src/renderer/src/components/ui/dialog.tsx
- apps/desktop/src/renderer/src/app.spec.tsx
- apps/desktop/src/renderer/src/components/workspace/left-sidebar.spec.tsx
- apps/desktop/src/renderer/src/components/workspace/workspace-shell.spec.tsx
- tests/integration/apps-desktop/terminal-manager.spec.ts
- apps/desktop/src/renderer/src/components/ui/feedback-bar.tsx (fix imports only)
- apps/desktop/src/renderer/src/components/workspace/git-diff-viewer.tsx (remove unused imports only)
- apps/desktop/src/renderer/src/components/workspace/left-sidebar.tsx (fix unused params only, minimally)
- apps/desktop/src/renderer/src/components/workspace/title-bar.tsx (fix unused params + non-null assertion)
- apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx (fix unused params/vars)

### A2 - Command Palette (NEW FEATURE)
OWNS: apps/desktop/src/renderer/src/components/command-palette/**
- New dir: create
- Integrate via apps/desktop/src/renderer/src/components/command-palette-host.tsx
- May ADD ONE single import line to apps/desktop/src/renderer/src/app.tsx (mount the palette host)
Hotkey Cmd+K. Fuzzy search commands, files, threads. Extensible registry.

### A3 - Settings Panel (NEW FEATURE)
OWNS: apps/desktop/src/renderer/src/components/settings/**
- New dir. Mount via a single import in app.tsx (coordinate with A2 by appending AFTER A2's line)
- Use existing dialog primitive. Theme, font size, terminal font family, auto-update prefs, dangerous zone (clear caches).
- Reads/writes app preferences via existing api.

### A4 - Keyboard Shortcuts System
OWNS: apps/desktop/src/renderer/src/lib/keyboard/**
- New dir. Declarative shortcut registry with conflict detection. React hook useKeyboardShortcut.
- Include help overlay (? key).
- Do NOT edit other components; export hooks and overlay for later wiring.

### A5 - Markdown / Code-Block Hardening
OWNS:
- apps/desktop/src/renderer/src/components/ui/markdown.tsx
- apps/desktop/src/renderer/src/components/ui/code-block.tsx
Add: copy button, language label, line numbers toggle, link safety (target/rel), image lazy loading, sanitize against XSS, heading anchors. Add unit tests next to files.

### A6 - IPC Security Hardening
OWNS:
- apps/desktop/src/main/ipc/sanitize-ipc-error.ts
- apps/desktop/src/main/ipc/payload-parsers.ts
- apps/desktop/src/main/fs/path-guards.ts
- apps/desktop/src/main/ipc/register-filesystem-handlers.ts
- apps/desktop/src/main/ipc/register-git-handlers.ts
- apps/desktop/src/main/ipc/register-dialog-handlers.ts
- packages/shared/src/ipc/channels.ts (append only new channels if needed)
- packages/shared/src/models/** (append only, coordinate non-destructive additions)
Tasks: add zod-like schema validation for every handler payload, size caps, path traversal guards with symlink resolution, rate limiting, structured error codes. Add tests in tests/integration/apps-desktop/ipc-security.spec.ts.

### A7 - Terminal Enhancements
OWNS:
- apps/desktop/src/main/terminal-manager.ts
- apps/desktop/src/main/terminal/**
- apps/desktop/src/renderer/src/components/ui/terminal.tsx
- apps/desktop/src/renderer/src/components/ui/terminal.spec.tsx
Add: search (Ctrl+F), clear, copy-on-select, URL detection/clickable links, resize debounce, scrollback config, theme sync, ANSI-safe logging. Tests alongside.

### A8 - Git Panel / Diff Viewer Features
OWNS:
- apps/desktop/src/renderer/src/components/workspace/git-panel.tsx
- apps/desktop/src/renderer/src/components/workspace/git-panel-model.ts
- apps/desktop/src/renderer/src/components/workspace/git-panel-model.spec.ts
- apps/desktop/src/renderer/src/components/workspace/git-diff-viewer.tsx (coord with A1 on unused imports)
- apps/desktop/src/renderer/src/components/workspace/git-status-chip.tsx
Features: stage/unstage hunks UI scaffolding, commit message templates, branch list, stash list, amend toggle, per-file revert, syntax-highlighted diffs, keyboard navigation. (Frontend-only where backend missing - stub behind a TODO feature flag.)

### A9 - File Tree & Search Enhancements
OWNS:
- apps/desktop/src/renderer/src/components/workspace/file-tree-panel.tsx
- apps/desktop/src/renderer/src/components/workspace/file-tree-item.tsx
- apps/desktop/src/renderer/src/components/workspace/file-tree-context-menu.tsx
- apps/desktop/src/renderer/src/hooks/use-file-tree.ts
- apps/desktop/src/renderer/src/components/workspace/workspace-file-content.tsx
- apps/desktop/src/renderer/src/components/workspace/center-file-viewer.tsx
Features: inline filter, multi-select, quick open (Cmd+P scaffold exporting a hook), keyboard nav, reveal-in-finder, copy path, new-file/new-folder. Only edit listed files. Tests in existing .spec files.

### A10 - Auto-Update & Telemetry Safety
OWNS:
- apps/desktop/src/main/auto-updater.ts
- apps/desktop/src/renderer/src/components/ui/update-banner.tsx (new)
- apps/desktop/src/renderer/src/hooks/use-updater.ts (new)
Add: user-consent check, deferred updates, progress events, error recovery, background check interval, manual-check API. Unit tests for the manager state machine.

### A11 - Observability & Logging
OWNS:
- apps/desktop/src/main/effect/logger.ts
- apps/desktop/src/main/effect/errors.ts
- packages/shared/src/observability/** (new dir)
Add: structured logs, log redaction for tokens/paths, in-memory ring buffer exposed via IPC for a devtools panel, crash reporter scaffolding, perf timers. Tests.

### A12 - Workspace Session State Hardening
OWNS:
- apps/desktop/src/renderer/src/stores/workspace-session-store.ts
- apps/desktop/src/renderer/src/stores/workspace-session-runtime.ts
- apps/desktop/src/renderer/src/stores/workspace-session-selectors.ts
- apps/desktop/src/renderer/src/stores/workspace-session-sync.ts
- apps/desktop/src/renderer/src/stores/ui-interaction-store.ts
Features: persistence versioning/migrations, selector memoization audit, undo/redo of ui state, typed selectors. Add .spec.ts tests for every file.

### A13 - Chat Experience
OWNS:
- apps/desktop/src/renderer/src/components/workspace/chat/**
- apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.tsx
- apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.spec.tsx
Features: message virtualization verification, copy message, retry failed, edit-and-resubmit scaffolding, token counter display, model picker inline, message timestamps tooltip. Tests updated.

### A14 - Prompt Dock / Autocomplete
OWNS:
- apps/desktop/src/renderer/src/components/workspace/prompt-dock/**
- apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx
- apps/desktop/src/renderer/src/components/workspace/prompt-dock.spec.tsx
- apps/desktop/src/renderer/src/components/ui/prompt-autocomplete.tsx
- apps/desktop/src/renderer/src/components/ui/prompt-input.tsx
- apps/desktop/src/renderer/src/lib/prompt-autocomplete-loader.ts
- apps/desktop/src/renderer/src/lib/prompt-routing.ts
Features: slash commands registry, @-file mentions, history (up/down), drafts per-thread, paste image, character counter, submit on Cmd+Enter. Tests alongside.

## Rules
- DO NOT edit files outside your OWNS list.
- If you need a type added to packages/shared, add it under packages/shared/src/<your-agent>/ and re-export, OR leave a TODO and implement inline.
- Write tests next to source files (*.spec.ts[x]) using vitest + @testing-library/react as existing code does.
- Run `bun run typecheck` scoped narrowly if possible before finishing. If too slow, rely on tsc diagnostics only for your files.
- Never run git commit or push.
- Never modify package.json, biome.json, tsconfig*.
- Keep imports using existing conventions (`@/`, `@pi-desktop/*`).
- Use Effect where existing code uses it; otherwise plain TS.
- Absolutely no `as` casts, no typecasts.
