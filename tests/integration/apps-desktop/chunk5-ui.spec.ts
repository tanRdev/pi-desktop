import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("chunk5 ui", () => {
  it("removes glassy gradients and decorative blur from the chat chrome", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const promptDockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(shellSource).not.toContain("CanvasContainer");
    expect(shellSource).not.toContain("CanvasGrid");
    expect(shellSource).not.toContain("WindowContentRouter");

    expect(promptDockSource).not.toContain("bg-gradient-to-t");
    expect(promptDockSource).not.toContain("text-zinc-500");
    expect(promptDockSource).not.toContain("bg-white/[0.06]");
    expect(promptDockSource).not.toContain("border-white/8");
    expect(promptDockSource).not.toContain(
      "linear-gradient(180deg,rgba(19,19,19,0)_0%",
    );
  });

  it("keeps the live shell selectors wired through the current workspace layout", () => {
    const shellStyleSource = readSource(
      "packages/ui/src/styles/pidesk-shell.css",
    );
    const liveShellStyleSource = readSource(
      "packages/ui/src/styles/pi-desktop-shell.css",
    );
    const workspaceShellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const workspaceSurfacePanelSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-surface-panel.tsx",
    );
    const promptDockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );
    const promptInputSource = readSource(
      "packages/ui/src/components/ui/prompt-input.tsx",
    );

    expect(shellStyleSource).toContain('@import "./pi-desktop-shell.css"');
    expect(liveShellStyleSource).toContain("--surface-1: #141414");
    expect(liveShellStyleSource).toContain(".glass");
    expect(liveShellStyleSource).toContain(".panel");

    expect(workspaceShellSource).toContain("chat-first-layout");
    expect(workspaceSurfacePanelSource).toContain("workspace-context-panel");
    expect(promptDockSource).toContain("PromptInput");
    expect(promptDockSource).toContain('data-testid="chat-send"');
    expect(promptInputSource).toContain("focus-visible:ring-0");
  });

  it("keeps the transcript selectors and current empty or streaming copy", () => {
    const chatSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.tsx",
    );
    const promptDockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(chatSource).toContain('data-testid="chat-transcript"');
    expect(promptDockSource).toContain('data-testid="chat-input"');
    expect(promptDockSource).toContain('data-testid="chat-send"');
    expect(promptDockSource).not.toContain("PromptSuggestionGroup");

    expect(chatSource).toContain("Pi is responding");
    expect(chatSource).toContain("Start a conversation with Pi.");
    expect(chatSource).toContain("text-[14px] leading-7");
    expect(chatSource).not.toContain("canvas preview");
    expect(chatSource).not.toContain("latest canvas state");
    expect(chatSource).not.toContain("border-dashed");
  });

  it("keeps the workspace at three columns max", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const railSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(shellSource).toContain("LeftRail");
    expect(shellSource).not.toContain("LeftSidebar");
    expect(shellSource).toContain("WorkspaceSurfacePanel");
    expect(railSource).not.toContain("NAVIGATION_ITEMS");
  });

  it("keeps message and prompt primitives compact without restoring legacy wrappers", () => {
    const messageSource = readSource(
      "apps/desktop/src/renderer/src/components/ui/message.tsx",
    );
    const promptInputSource = readSource(
      "packages/ui/src/components/ui/prompt-input.tsx",
    );

    expect(messageSource).toContain("shell-console-message");
    expect(messageSource).toContain("rounded-sm");
    expect(messageSource).toContain("text-sm leading-7");
    expect(messageSource).not.toContain("rounded-md p-3 text-sm");

    expect(promptInputSource).toContain("min-h-[44px]");
    expect(promptInputSource).toContain("focus-visible:border-none");
    expect(promptInputSource).toContain("focus-visible:ring-0");
  });
});
