import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("side panel toggle contract", () => {
  it("removes the create worktree, browse files, and git icons from the title bar", () => {
    const titleBarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );

    expect(titleBarSource).not.toContain("Create worktree");
    expect(titleBarSource).not.toContain("Browse files");
    expect(titleBarSource).not.toContain("Open git");
    expect(titleBarSource).toContain("isActive");
    expect(titleBarSource).toContain("onToggleSidePanel");
  });

  it("keeps the remaining rail and repository switcher affordances minimal", () => {
    const railSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );
    const switcherSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/repository-switcher.tsx",
    );

    expect(railSource).toContain("overflow-y-auto");
    expect(switcherSource).toContain("triggerAriaLabel?: string");
    expect(switcherSource).toContain(
      'const triggerTitle = triggerAriaLabel ?? "Switch projects";',
    );
    expect(switcherSource).not.toContain("ChevronDown");
  });

  it("removes the tab header and stale window-selection chrome from the surface panel", () => {
    const surfacePanelSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-surface-panel.tsx",
    );

    expect(surfacePanelSource).not.toContain("onSelectWindow");
    expect(surfacePanelSource).not.toContain("getSurfaceLabel");
    expect(surfacePanelSource).not.toContain("getSurfaceIcon");
    expect(surfacePanelSource).not.toContain("onCloseWindow(window.id)");
    expect(surfacePanelSource).not.toContain("Close ");
  });

  it("toggles terminal and git surfaces closed when the active control is re-clicked", () => {
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );
    const titleBarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );

    expect(controllerSource).toContain(
      "existingGitWindow.id === selectedContextSurface",
    );
    expect(controllerSource).toContain(
      "existingTerminal.id === selectedContextSurface",
    );
    expect(controllerSource).not.toContain("handleOpenNote");
    expect(controllerSource).toContain("setSelectedContextSurface(null)");
    expect(titleBarSource).not.toContain("Open notes");
  });

  it("keeps only one side surface open at a time by replacing prior contextual windows", () => {
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(controllerSource).toContain("windowStore.closeWindow(");
    expect(controllerSource).toContain("window.id !== selectedContextSurface");
    expect(shellSource).toContain("renderRightPanelContent()");
  });
});
