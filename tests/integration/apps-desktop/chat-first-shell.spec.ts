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

    expect(shellSource).toContain('data-testid="chat-first-layout"');
    expect(shellSource).toContain('data-testid="workspace-context-panel"');
    expect(shellSource).toContain("WorkspaceSurfacePanel");
    expect(shellSource).not.toContain("CanvasContainer");
    expect(shellSource).not.toContain("CanvasGrid");
    expect(shellSource).not.toContain("WindowContentRouter");
    expect(shellSource).not.toContain("CanvasEmptyState");
  });

  it("boots threads without canvas centering helpers", () => {
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(controllerSource).toContain("threadBootstrapAttemptKeyRef");
    expect(controllerSource).not.toContain("handleOpenBlankStateChat");
    expect(controllerSource).not.toContain("canvasBounds");
    expect(controllerSource).not.toContain("openOrFocusChatWindow");
  });

  it("renders the transcript from the workspace component tree", () => {
    const chatSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.tsx",
    );

    expect(chatSource).toContain('data-testid="chat-transcript"');
    expect(chatSource).not.toContain("canvas preview");
    expect(chatSource).not.toContain("latest canvas state");
  });
});
