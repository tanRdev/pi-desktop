import { createEmptyWorkspaceSession } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";

import { reconcileWorkspaceSessions } from "./shell-catalog-builder-workspace-sessions";

describe("reconcileWorkspaceSessions", () => {
  it("drops stale windows and rewrites out-of-worktree terminal and git paths", () => {
    const session = createEmptyWorkspaceSession("/tmp/repo/worktrees/feature");
    session.layout.windows = [
      {
        id: "chat-current",
        kind: "chat",
        title: "Current",
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        zIndex: 1,
        isFocused: false,
        state: "normal",
        threadId: "thread-current",
      },
      {
        id: "chat-stale",
        kind: "chat",
        title: "Stale",
        x: 10,
        y: 10,
        width: 400,
        height: 300,
        zIndex: 2,
        isFocused: false,
        state: "normal",
        threadId: "thread-stale",
      },
      {
        id: "file-current",
        kind: "file",
        title: "inside.ts",
        x: 20,
        y: 20,
        width: 400,
        height: 300,
        zIndex: 3,
        isFocused: true,
        state: "normal",
        filePath: "/tmp/repo/worktrees/feature/src/inside.ts",
        isDirty: false,
      },
      {
        id: "file-stale",
        kind: "file",
        title: "outside.ts",
        x: 30,
        y: 30,
        width: 400,
        height: 300,
        zIndex: 4,
        isFocused: false,
        state: "normal",
        filePath: "/tmp/repo/src/outside.ts",
        isDirty: false,
      },
      {
        id: "terminal-stale",
        kind: "terminal",
        title: "Terminal",
        x: 40,
        y: 40,
        width: 500,
        height: 320,
        zIndex: 5,
        isFocused: false,
        state: "normal",
        terminalId: "term-1",
        backend: "shell",
        cwd: "/tmp/repo",
      },
      {
        id: "git-stale",
        kind: "git",
        title: "Git",
        x: 50,
        y: 50,
        width: 520,
        height: 340,
        zIndex: 6,
        isFocused: false,
        state: "normal",
        repositoryPath: "/tmp/repo",
      },
    ];
    session.layout.focusedWindowId = "chat-stale";
    session.layout.nextZIndex = 1;
    session.promptDrafts = {
      "thread-current": "keep me",
      "thread-stale": "drop me",
    };
    session.recoveryDrafts = {
      note: {
        kind: "note",
        text: "keep note",
        updatedAt: 3,
      },
      "thread-current": {
        kind: "thread",
        text: "keep thread",
        updatedAt: 4,
      },
      "thread-stale": {
        kind: "thread",
        text: "drop thread",
        updatedAt: 5,
      },
    };
    session.files = {
      "/tmp/repo/worktrees/feature/src/inside.ts": {
        filePath: "/tmp/repo/worktrees/feature/src/inside.ts",
        scrollTop: 12,
      },
      "/tmp/repo/src/outside.ts": {
        filePath: "/tmp/repo/src/outside.ts",
        scrollTop: 0,
      },
    };
    session.search = {
      query: "inside",
      selectedPath: "/tmp/repo/src/outside.ts",
    };

    const [reconciled] = reconcileWorkspaceSessions({
      repositories: [
        {
          id: "/tmp/repo",
          order: 0,
          name: "Repo",
          customName: null,
          icon: null,
          accentColor: null,
          rootPath: "/tmp/repo",
          defaultBranch: "main",
          worktrees: [
            {
              id: "/tmp/repo/worktrees/feature",
              label: "feature",
              path: "/tmp/repo/worktrees/feature",
              isMain: false,
              isDetached: false,
              git: {
                status: "ready",
                branch: "feature",
                commit: "abc1234",
                hasChanges: false,
                ahead: 0,
                behind: 0,
                stagedCount: 0,
                modifiedCount: 0,
                untrackedCount: 0,
                message: null,
              },
              threads: [
                {
                  id: "thread-current",
                  title: "Current",
                  createdAt: 1,
                  lastActivityAt: 2,
                  runtime: {
                    status: "ready",
                    lastError: null,
                  },
                },
              ],
              createdAt: 1,
            },
          ],
        },
      ],
      workspaceSessions: [session],
    });

    expect(reconciled?.layout.windows.map((window) => window.id)).toEqual([
      "chat-current",
      "file-current",
      "terminal-stale",
      "git-stale",
    ]);
    expect(reconciled?.layout.focusedWindowId).toBe("chat-current");
    expect(reconciled?.layout.nextZIndex).toBe(7);
    expect(reconciled?.promptDrafts).toEqual({
      "thread-current": "keep me",
    });
    expect(reconciled?.recoveryDrafts).toEqual({
      note: {
        kind: "note",
        text: "keep note",
        updatedAt: 3,
      },
      "thread-current": {
        kind: "thread",
        text: "keep thread",
        updatedAt: 4,
      },
    });
    expect(reconciled?.files).toEqual({
      "/tmp/repo/worktrees/feature/src/inside.ts": {
        filePath: "/tmp/repo/worktrees/feature/src/inside.ts",
        scrollTop: 12,
      },
    });
    expect(reconciled?.search.selectedPath).toBeNull();
    expect(
      reconciled?.layout.windows.find(
        (window) => window.id === "terminal-stale",
      ),
    ).toMatchObject({
      backend: "shell",
      cwd: "/tmp/repo/worktrees/feature",
    });
    expect(
      reconciled?.layout.windows.find((window) => window.id === "git-stale"),
    ).toMatchObject({
      repositoryPath: "/tmp/repo/worktrees/feature",
    });
  });

  it("drops sessions whose worktree no longer exists", () => {
    const session = createEmptyWorkspaceSession("/tmp/repo/missing");

    expect(
      reconcileWorkspaceSessions({
        repositories: [],
        workspaceSessions: [session],
      }),
    ).toEqual([]);
  });
});
