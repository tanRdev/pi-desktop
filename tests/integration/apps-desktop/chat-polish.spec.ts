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

    expect(shellSource).toContain("const hasTranscriptHistory =");
    expect(shellSource).toContain("data-composer-state={");
    expect(shellSource).toContain(
      'hasTranscriptHistory ? "docked" : "floating"',
    );
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
    expect(chatSource).toContain("w-fit max-w-[42rem]");
  });
});
