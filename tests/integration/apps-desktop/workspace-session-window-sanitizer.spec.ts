import { describe, expect, it } from "vitest";
import { sanitizeWorkspaceWindow } from "../../../apps/desktop/src/main/workspace-session-window-sanitizer";

describe("sanitizeWorkspaceWindow", () => {
  it("keeps valid search results and drops malformed entries", () => {
    const sanitized = sanitizeWorkspaceWindow({
      id: "search-1",
      kind: "search",
      title: "Search",
      x: 24,
      y: 36,
      width: 640,
      height: 480,
      zIndex: 3,
      isFocused: true,
      state: "normal",
      query: "workspace",
      results: [
        {
          path: "/repo/src/index.ts",
          name: "index.ts",
          score: 1.2,
          type: "file",
          extension: "ts",
        },
        {
          path: "/repo/src",
          name: "src",
          score: 0.8,
          type: "directory",
          extension: 42,
        },
        {
          path: "/repo/bad",
          score: 0.1,
          type: "file",
        },
        "invalid",
      ],
      linkColor: "teal",
      linkTargetIds: ["thread-1", 42, "thread-2"],
      transcriptBodies: {
        thread: "drop me",
      },
    });

    expect(sanitized).toEqual({
      id: "search-1",
      kind: "search",
      title: "Search",
      x: 24,
      y: 36,
      width: 640,
      height: 480,
      zIndex: 3,
      isFocused: true,
      state: "normal",
      query: "workspace",
      results: [
        {
          path: "/repo/src/index.ts",
          name: "index.ts",
          score: 1.2,
          type: "file",
          extension: "ts",
        },
        {
          path: "/repo/src",
          name: "src",
          score: 0.8,
          type: "directory",
        },
      ],
      linkTargetIds: ["thread-1", "thread-2"],
    });
  });
});
