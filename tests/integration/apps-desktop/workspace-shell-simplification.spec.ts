import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("workspace shell simplification", () => {
  it("keeps the title bar limited to terminal and side-panel actions", () => {
    const titleBarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );
    const surfacePanelSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-surface-panel.tsx",
    );

    expect(titleBarSource).toContain('data-slot="titlebar-controls"');
    expect(titleBarSource).toContain("onOpenTerminal");
    expect(titleBarSource).toContain("onToggleSidePanel");
    expect(titleBarSource).not.toContain("onOpenFileTree");
    expect(titleBarSource).not.toContain("onOpenNote");
    expect(titleBarSource).not.toContain("onOpenGit");
    expect(titleBarSource).not.toContain("onOpenSettings");
    expect(titleBarSource).not.toContain("Create worktree");
    expect(surfacePanelSource).not.toContain("sidecar-action-launcher");
    expect(surfacePanelSource).not.toContain('label: "Browse files"');
    expect(surfacePanelSource).not.toContain('label: "Open notes"');
    expect(surfacePanelSource).not.toContain('label: "Open terminal"');
    expect(surfacePanelSource).not.toContain('backend="lazygit"');
    expect(surfacePanelSource).not.toContain("WorkspaceNoteContent");
  });

  it("removes the floating prompt container and status strip chrome", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const promptDockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(shellSource).not.toContain("<StatusBar");
    expect(shellSource).not.toContain("absolute inset-x-0 bottom-0");
    expect(shellSource).not.toContain("max-w-[72rem]");
    expect(promptDockSource).not.toContain('data-testid="agent-status"');
  });

  it("uses icon-only attachment controls and the current model popover", () => {
    const promptDockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(promptDockSource).toContain('aria-label="Attach files"');
    expect(promptDockSource).not.toContain(">Attach files<");
    expect(promptDockSource).toContain('data-testid="model-selector-trigger"');
    expect(promptDockSource).toContain("PopoverContent");
  });

  it("keeps the active repository summary in the rail header and removes redundant rail chrome", () => {
    const railSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(railSource).toContain('data-testid="left-rail"');
    expect(railSource).toContain("activeRepositoryName");
    expect(railSource).not.toContain("ProjectCustomizationMenu");
    expect(railSource).not.toContain("Edit");
    expect(railSource).not.toContain(">Settings<");
    expect(railSource).not.toContain(">New worktree<");
  });

  it("shows user messages on the right and simplifies the responding state", () => {
    const chatSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.tsx",
    );

    expect(chatSource).toContain("justify-end items-end");
    expect(chatSource).toContain("Pi is responding");
    expect(chatSource).not.toContain("TextShimmer");
    expect(chatSource).not.toContain("Steps");
    expect(chatSource).not.toContain("ThinkingBar");
  });
});
