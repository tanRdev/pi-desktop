import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("chat-window-content", () => {
  it("marks the transcript region for e2e selectors", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "apps/desktop/src/renderer/src/components/canvas/chat-window-content.tsx",
      ),
      "utf8",
    );

    expect(source).toContain('data-testid="chat-transcript"');
  });
});
