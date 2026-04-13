import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("design refinements - css foundation", () => {
  it("keeps the legacy shell entrypoint as a shim into the live stylesheet", () => {
    const legacyShellCss = readSource(
      "packages/ui/src/styles/pidesk-shell.css",
    );

    expect(legacyShellCss).toContain('@import "./pi-desktop-shell.css"');
  });

  it("defines the current shell color tokens and utility hooks", () => {
    const shellCss = readSource("packages/ui/src/styles/pi-desktop-shell.css");

    expect(shellCss).toContain("--surface-1: #141414");
    expect(shellCss).toContain("--muted-foreground: #6a6a6a");
    expect(shellCss).toContain("--border: #222222");
    expect(shellCss).toContain(".glass");
    expect(shellCss).toContain(".panel");
  });
});

describe("design refinements - workspace chrome", () => {
  it("keeps the left rail and title bar compact and selector-driven", () => {
    const railSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );
    const titleSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );

    expect(railSource).toContain('data-testid="left-rail"');
    expect(railSource).toContain("export const SIDEBAR_WIDTH = 240");
    expect(titleSource).toContain('data-slot="titlebar-controls"');
    expect(titleSource).toContain('label: "Open terminal"');
    expect(titleSource).toContain('aria-label="Toggle side panel"');
    expect(titleSource).not.toContain("Open notes");
  });

  it("keeps the prompt dock focused on file upload, model switching, and send controls", () => {
    const dockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(dockSource).toContain("FileUpload");
    expect(dockSource).toContain("Image");
    expect(dockSource).toContain("Loader");
    expect(dockSource).toContain('data-testid="model-selector-trigger"');
    expect(dockSource).toContain('data-testid="chat-send"');
    expect(dockSource).not.toContain("PromptSuggestionGroup");
    expect(dockSource).not.toContain("Enter to send");
  });

  it("renders transcript and contextual surface selectors from the live shell", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const chatSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.tsx",
    );
    const surfaceSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-surface-panel.tsx",
    );

    expect(shellSource).toContain('data-testid="chat-first-layout"');
    expect(chatSource).toContain('data-testid="chat-transcript"');
    expect(surfaceSource).toContain('data-testid="workspace-context-panel"');
    expect(surfaceSource).not.toContain("WorkspaceNoteContent");
  });

  it("keeps message, thread, and worktree primitives compact", () => {
    const messageSource = readSource(
      "apps/desktop/src/renderer/src/components/ui/message.tsx",
    );
    const threadSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/thread-list-item.tsx",
    );
    const worktreeSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/worktree-section.tsx",
    );

    expect(messageSource).toContain("shell-console-message");
    expect(messageSource).toContain("rounded-sm");
    expect(threadSource).toContain('data-testid="thread-list-item"');
    expect(threadSource).toContain("rounded-sm px-1.5 py-1.5");
    expect(worktreeSource).toContain('data-testid="create-thread-button"');
  });
});

describe("design refinements - regression guards", () => {
  it("does not reintroduce the old canvas shell or dashed workspace chrome", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const chatSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.tsx",
    );

    expect(shellSource).not.toContain("CanvasContainer");
    expect(shellSource).not.toContain("CanvasGrid");
    expect(shellSource).not.toContain("CanvasEmptyState");
    expect(chatSource).not.toContain("border-dashed");
  });
});
