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
      'className="pointer-events-none absolute inset-x-0 bottom-6 z-20"',
    );
    expect(source).not.toContain('activeThreadId && "pb-40"');
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
