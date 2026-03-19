import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("chunk5 ui", () => {
  it("removes glassy gradients and decorative blur from the chat chrome", () => {
    const windowSource = readSource(
      "apps/desktop/src/renderer/src/components/canvas/window-chrome.tsx",
    );
    const promptDockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(windowSource).not.toContain("rounded-lg");
    expect(windowSource).not.toContain("shadow-xl");
    expect(windowSource).not.toContain("ring-neutral-200/50");
    expect(windowSource).not.toContain("bg-gradient-to-b");
    expect(windowSource).not.toContain("backdrop-blur-sm");

    expect(promptDockSource).not.toContain("bg-gradient-to-t");
    expect(promptDockSource).not.toContain("text-zinc-500");
    expect(promptDockSource).not.toContain("bg-white/[0.06]");
    expect(promptDockSource).not.toContain("border-white/8");
  });

  it("adds flatter shell hooks that centralize the mission-control styling", () => {
    const shellSource = readSource("packages/ui/src/styles/pidesk-shell.css");
    const windowSource = readSource(
      "apps/desktop/src/renderer/src/components/canvas/window-chrome.tsx",
    );
    const promptDockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );
    const promptInputSource = readSource(
      "packages/ui/src/components/ui/prompt-input.tsx",
    );

    expect(shellSource).toContain(".shell-window");
    expect(shellSource).toContain(".shell-titlebar");
    expect(shellSource).toContain(".shell-control-dot");
    expect(shellSource).toContain(".shell-backdrop");
    expect(shellSource).toContain(".shell-console-panel");
    expect(shellSource).toContain(".shell-console-message");
    expect(shellSource).toContain(".shell-dock");
    expect(shellSource).toContain(".shell-token");
    expect(shellSource).toContain(".shell-send-button");
    expect(shellSource).toContain(".shell-input-frame");

    expect(windowSource).toContain("shell-window");
    expect(windowSource).toContain("shell-titlebar");
    expect(windowSource).toContain("shell-control-dot");
    expect(windowSource).toContain("shell-backdrop");
    expect(promptDockSource).toContain("shell-dock");
    expect(promptDockSource).toContain("shell-token");
    expect(promptDockSource).toContain("shell-send-button");
    expect(promptInputSource).toContain("shell-input-frame");
  });

  it("tightens transcript density while preserving required chat selectors", () => {
    const chatSource = readSource(
      "apps/desktop/src/renderer/src/components/canvas/chat-window-content.tsx",
    );
    const promptDockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(chatSource).toContain('data-testid="chat-transcript"');
    expect(promptDockSource).toContain('data-testid="chat-input"');
    expect(promptDockSource).toContain('data-testid="chat-send"');
    expect(promptDockSource).toContain('data-testid="agent-status"');

    expect(chatSource).toContain("gap-3");
    expect(chatSource).toContain("px-4 py-4");
    expect(chatSource).toContain("text-[13px] leading-6");
    expect(chatSource).toContain("shell-console-panel");
    expect(chatSource).not.toContain("gap-5");
    expect(chatSource).not.toContain("px-5 py-5");
    expect(chatSource).not.toContain("text-base leading-relaxed");
    expect(chatSource).not.toContain("border-dashed");
    expect(chatSource).not.toContain("rounded-lg border border-dashed");
  });

  it("reshapes message and shared prompt primitives for compact console surfaces", () => {
    const messageSource = readSource(
      "apps/desktop/src/renderer/src/components/ui/message.tsx",
    );
    const promptInputSource = readSource(
      "packages/ui/src/components/ui/prompt-input.tsx",
    );

    expect(messageSource).toContain("shell-console-message");
    expect(messageSource).toContain("rounded-sm");
    expect(messageSource).toContain("px-3 py-2");
    expect(messageSource).toContain("text-[13px] leading-6");
    expect(messageSource).not.toContain("rounded-md p-3 text-sm");

    expect(promptInputSource).toContain("shell-input-frame");
    expect(promptInputSource).toContain("p-2");
    expect(promptInputSource).not.toContain("rounded-lg");
    expect(promptInputSource).not.toContain("rounded-3xl");
    expect(promptInputSource).not.toContain("shadow-xs");
  });
});
