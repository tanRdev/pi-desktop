import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("workspace shell UI guards", () => {
  it("boots blank canvases into chat flow instead of auto-opening project notes", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(shellSource).toContain("onOpenBlankStateChat");
    expect(shellSource).toContain("activeWorktreeId");
    expect(shellSource).not.toContain("hasAutoOpened");
    expect(shellSource).not.toContain("onOpenNote()\n");
    expect(controllerSource).toContain("const handleOpenBlankStateChat");
    expect(controllerSource).toContain("window.pidesk.threads.create");
  });

  it("keeps prompt autocomplete free to escape the animated prompt shell", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(source).not.toContain('"relative overflow-hidden"');
    expect(source).toContain(
      'className="absolute left-0 right-0 top-full z-20 mt-2"',
    );
  });

  it("positions the integrated prompt above the fixed status bar", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(source).toContain(
      'className="pointer-events-none absolute bottom-6 left-1/2 z-20 w-full max-w-[38rem] -translate-x-1/2 px-4"',
    );
    expect(source).not.toContain('activeThreadId && "pb-40"');
  });

  it("keeps the prompt dock drawer-sized instead of stretching across the workspace", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const dockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(shellSource).toContain(
      'className="pointer-events-none absolute bottom-6 left-1/2 z-20 w-full max-w-[38rem] -translate-x-1/2 px-4"',
    );
    expect(shellSource).not.toContain(
      'className="pointer-events-none absolute inset-x-0 bottom-6 z-20"',
    );
    expect(dockSource).not.toContain("max-w-[44rem]");
    expect(dockSource).toContain("relative w-full");
  });

  it("auto-hides the prompt drawer unless a chat thread is focused", () => {
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(controllerSource).toContain('focusedWindow?.kind === "chat"');
    expect(controllerSource).not.toContain(
      '(!focusedWindow || focusedWindow.kind === "chat")',
    );
  });

  it("routes prompt input submit through stop while a prompt is executing", () => {
    const dockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(dockSource).toContain("onSubmit={() =>");
    expect(dockSource).toContain(
      "void (isPromptExecuting ? onCancelPrompt() : onSend())",
    );
  });

  it("compresses prompt suggestions into a single compact horizontal row", () => {
    const suggestionSource = readSource(
      "apps/desktop/src/renderer/src/components/ui/prompt-suggestion.tsx",
    );

    expect(suggestionSource).toContain(
      "inline-flex h-9 min-w-fit shrink-0 items-center gap-2.5 whitespace-nowrap",
    );
    expect(suggestionSource).toContain("items-center gap-1.5 truncate");
    expect(suggestionSource).not.toContain("h-12 min-w-[15rem]");
    expect(suggestionSource).not.toContain(
      "block truncate text-[11px] leading-4",
    );
  });

  it("uses an explicit prompt stop action and overlay-only launcher search results", () => {
    const dockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(dockSource).toContain('isPromptExecuting ? "STOP" : "EXECUTE"');
    expect(dockSource).toContain("onCancelPrompt");
    expect(controllerSource).toContain("window.pidesk.search.searchFiles");
    expect(controllerSource).not.toContain(
      "await handleSearchQueryChange(LAUNCHER_WINDOW_ID, query)",
    );
  });

  it("adds accessible labels to icon-only title bar actions", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );

    expect(source).toContain('aria-label="Toggle workspace sidebar"');
    expect(source).toContain('aria-label="Open file tree"');
    expect(source).toContain('aria-label="Open launcher"');
    expect(source).toContain('aria-label="Open notes"');
    expect(source).toContain("onClick={onOpenNote}");
  });

  it("moves launcher and file browsing into overlays instead of canvas windows or right sidebar panes", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(shellSource).toContain('aria-label="Launcher overlay"');
    expect(shellSource).toContain('aria-label="File tree overlay"');
    expect(shellSource).not.toContain('sidebarView === "files"');
    expect(controllerSource).toContain("openLauncherOverlay");
    expect(controllerSource).not.toContain(
      'createWindow(\n      { kind: "search" }',
    );
  });

  it("reduces the title bar to project name, worktree selector, and icon actions", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );

    expect(source).toContain("projectName");
    expect(source).toContain("activeWorktreeLabel");
    expect(source).not.toContain(">TERMINAL<");
    expect(source).not.toContain(">LAUNCHER<");
    expect(source).not.toContain(">FILES<");
    expect(source).not.toContain(">GIT<");
  });

  it("labels the workspace search input for assistive tech", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-sidebar.tsx",
    );

    expect(source).toContain('aria-label="Search worktrees or threads"');
  });

  it("starts with the project selector flow before any workspace navigation", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(source).toContain('>("projects")');
    expect(source).toContain("React.useState<RailView>(null)");
    expect(source).not.toContain(
      'activeThreadId || activeWorktreeId ? "workspace" : "projects"',
    );
  });

  it("treats the extensions view as a real surface instead of a disclaimer", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-sidebar.tsx",
    );

    expect(source).not.toContain(
      "No external extension registry is wired into this shell yet.",
    );
  });

  it("centers the blank-state chat window using measured canvas bounds", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(source).toContain("getBoundingClientRect");
    expect(source).toContain("canvasBounds");
  });
});
