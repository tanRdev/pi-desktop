import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("chat polish", () => {
  it("docks the composer after the conversation starts", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(shellSource).toContain("<PromptDock");
    expect(shellSource).toContain("isVisible={isPromptVisible}");
  });

  it("renames the visible assistant branding from PiDesk to Pi", () => {
    const chatSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.tsx",
    );
    const promptDockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );

    expect(chatSource).toContain('return "Pi";');
    expect(promptDockSource).toContain(
      "Ask Pi to inspect, plan, fix, or ship…",
    );
  });

  it("removes chat avatars and lets message bubbles size to their content", () => {
    const chatSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.tsx",
    );

    expect(chatSource).not.toContain(
      "rounded-lg border border-white/[0.06] bg-white/[0.04]",
    );
    expect(chatSource).not.toContain(
      "rounded-full bg-gradient-to-br from-purple-500 to-pink-500",
    );
    expect(chatSource).toContain("max-w-3xl mx-auto px-6");
  });

  it("does not ship a fake transcript fallback when a thread is empty", () => {
    const chatSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.tsx",
    );

    expect(chatSource).not.toContain('id: "mock-1"');
    expect(chatSource).toContain("Start a conversation with Pi.");
  });
});
