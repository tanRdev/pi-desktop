import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("agent feed ESM source imports", () => {
  it("uses runtime relative specifiers with .js extensions", async () => {
    const source = await readFile(
      new URL("./agent-feed.ts", import.meta.url),
      "utf8",
    );
    const liveSource = await readFile(
      new URL("./agent-feed-live.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain('from "./agent-feed-live.js"');
    expect(source).toContain('from "./agent-feed-transcript.js"');
    expect(liveSource).toContain('from "./agent-feed-live-state.js"');
  });
});
