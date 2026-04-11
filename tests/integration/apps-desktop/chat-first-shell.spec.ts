import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("chat-first workspace shell", () => {
  it("replaces the canvas shell with a split chat workspace", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const surfacePanelSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-surface-panel.tsx",
    );

    expect(shellSource).toContain('data-testid="chat-first-layout"');
    expect(shellSource).toContain("WorkspaceSurfacePanel");
    expect(shellSource).not.toContain("LeftSidebar");
    expect(surfacePanelSource).toContain(
      'data-testid="workspace-context-panel"',
    );
    expect(shellSource).not.toContain("CanvasContainer");
    expect(shellSource).not.toContain("CanvasGrid");
    expect(shellSource).not.toContain("WindowContentRouter");
    expect(shellSource).not.toContain("CanvasEmptyState");
  });

  it("boots threads without canvas centering helpers", () => {
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(controllerSource).toContain("await window.pidesk.threads.create");
    expect(controllerSource).toContain("await window.pidesk.threads.select");
    expect(controllerSource).not.toContain("handleOpenBlankStateChat");
    expect(controllerSource).not.toContain("canvasBounds");
    expect(controllerSource).not.toContain("openOrFocusChatWindow");
  });

  it("renders the selected thread from the per-thread conversation cache", () => {
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(controllerSource).toContain("selectThreadConversationByWorktree");
    expect(controllerSource).toContain(
      "threadMessages: activeThreadConversation?.messages ?? agent.messages",
    );
    expect(controllerSource).toContain(
      "threadLastError: activeThreadConversation?.lastError ?? agent.lastError",
    );
  });

  it("renders the transcript from the workspace component tree", () => {
    const chatSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.tsx",
    );
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(chatSource).toContain('data-testid="chat-transcript"');
    expect(shellSource).toContain("PromptDock");
    expect(shellSource).toContain(
      "autocompleteSuggestions={autocompleteSuggestions}",
    );
    expect(shellSource).toContain(
      "onAutocompleteSelect={onAutocompleteSelect}",
    );
    expect(chatSource).not.toContain("Chat-first workspace");
    expect(chatSource).not.toContain("canvas preview");
    expect(chatSource).not.toContain("latest canvas state");
  });

  it("wires the plan and build prompt modes into local Pi skills", () => {
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );
    const promptDockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(controllerSource).toContain('build: "/skill:build "');
    expect(controllerSource).toContain('plan: "/skill:plan "');
    expect(promptDockSource).toContain(
      'export type PromptMode = "build" | "plan";',
    );
    expect(promptDockSource).toContain(
      "onPromptModeChange?: (mode: PromptMode) => void;",
    );
  });
});
