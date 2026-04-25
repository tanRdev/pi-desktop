import { createEmptyWorkspaceSession } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";
import {
  migrateWorkspaceSessionSnapshot,
  sanitizeWorkspaceSessionLayout,
  WORKSPACE_SESSION_SCHEMA_VERSION,
} from "./workspace-session-store-migrations";

describe("workspace-session-store-migrations", () => {
  it("exports the current workspace session schema version", () => {
    expect(WORKSPACE_SESSION_SCHEMA_VERSION).toBe(2);
  });

  it("migrates legacy search windows out of persisted sessions", () => {
    const result = migrateWorkspaceSessionSnapshot({
      schemaVersion: 1,
      session: {
        worktreeId: "wt-seam",
        layout: {
          windows: [
            {
              id: "w-search",
              kind: "search",
              title: "Search",
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              zIndex: 2,
              isFocused: true,
              state: "normal",
              query: "term",
              results: [],
            },
            {
              id: "w-file",
              kind: "file",
              title: "file.ts",
              x: 0,
              y: 0,
              width: 200,
              height: 200,
              zIndex: 3,
              isFocused: false,
              state: "normal",
              filePath: "/tmp/file.ts",
              isDirty: false,
            },
          ],
          nextZIndex: 4,
          focusedWindowId: "w-search",
          snapGridSize: 24,
          zoom: 1,
          panX: 0,
          panY: 0,
        },
        sidebar: { activePanel: null, isCollapsed: false },
        promptDrafts: {},
        search: { query: "", selectedPath: null },
        files: {},
        notes: {},
        recoveryDrafts: {},
      },
    });

    expect(result?.layout.windows).toHaveLength(1);
    expect(result?.layout.windows[0]?.id).toBe("w-file");
    expect(result?.layout.focusedWindowId).toBeNull();
  });

  it("sanitizes layouts by dropping search windows and refocusing the top active window", () => {
    const session = createEmptyWorkspaceSession("wt-layout");

    const layout = sanitizeWorkspaceSessionLayout({
      ...session.layout,
      windows: [
        {
          id: "w-search",
          kind: "search",
          title: "Search",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 1,
          isFocused: false,
          state: "normal",
          query: "term",
          results: [],
        },
        {
          id: "w-minimized",
          kind: "chat",
          title: "Chat",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 5,
          isFocused: false,
          state: "minimized",
          threadId: "thread-1",
        },
        {
          id: "w-active",
          kind: "terminal",
          title: "Terminal",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 4,
          isFocused: true,
          state: "normal",
          terminalId: "terminal-1",
          backend: "shell",
          cwd: "/tmp",
        },
      ],
      focusedWindowId: "w-search",
    });

    expect(layout.windows.map((window) => window.id)).toEqual([
      "w-minimized",
      "w-active",
    ]);
    expect(layout.focusedWindowId).toBe("w-active");
  });
});
