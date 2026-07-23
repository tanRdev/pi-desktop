import { describe, expect, it } from "vitest";
import { sanitizeWorkspaceWindow } from "../../../apps/desktop/src/main/workspace-session-window-sanitizer";

describe("sanitizeWorkspaceWindow", () => {
  it("drops legacy search windows", () => {
    expect(
      sanitizeWorkspaceWindow({
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
        ],
      }),
    ).toBeNull();
  });

  it("keeps valid chat windows and drops malformed link metadata", () => {
    const sanitized = sanitizeWorkspaceWindow({
      id: "chat-1",
      kind: "chat",
      title: "Chat",
      x: 24,
      y: 36,
      width: 640,
      height: 480,
      zIndex: 3,
      isFocused: true,
      state: "normal",
      threadId: "thread-1",
      linkColor: "teal",
      linkTargetIds: ["thread-1", 42, "thread-2"],
      transcriptBodies: {
        thread: "drop me",
      },
    });

    expect(sanitized).toEqual({
      id: "chat-1",
      kind: "chat",
      title: "Chat",
      x: 24,
      y: 36,
      width: 640,
      height: 480,
      zIndex: 3,
      isFocused: true,
      state: "normal",
      threadId: "thread-1",
      linkTargetIds: ["thread-1", "thread-2"],
    });
  });
});
