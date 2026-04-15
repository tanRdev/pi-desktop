import { describe, expect, it } from "vitest";
import { buildShellCatalog } from "../../../apps/desktop/src/main/shell-catalog-builder";
import {
  type AgentSnapshot,
  createEmptyWorkspaceSession,
} from "../../../packages/shared/src";

describe("buildShellCatalog", () => {
  it("merges repository catalog entries, git worktrees, thread catalog entries, and selected runtime state", async () => {
    const selectedAgentSnapshot: AgentSnapshot = {
      sessionId: "selected-session",
      status: "streaming",
      messages: [],
      lastError: null,
    };

    const catalog = await buildShellCatalog({
      repositories: [
        {
          id: "/tmp/repo-alpha",
          rootPath: "/tmp/repo-alpha",
          label: "Alpha",
          order: 0,
          lastSelectedWorktreeId: "/tmp/repo-alpha",
          addedAt: 1,
          updatedAt: 1,
        },
        {
          id: "/tmp/repo-beta",
          rootPath: "/tmp/repo-beta",
          label: null,
          order: 1,
          lastSelectedWorktreeId: "/tmp/repo-beta/feature",
          addedAt: 2,
          updatedAt: 2,
        },
      ],
      selection: {
        repositoryId: "/tmp/repo-beta",
        worktreeId: "/tmp/repo-beta/feature",
        threadId: "thread-selected",
      },
      repositoryPreferences: [
        {
          repositoryId: "/tmp/repo-beta",
          customName: "Beta Custom",
          icon: "beaker",
          accentColor: "#ee6600",
        },
      ],
      workspaceSessions: [
        (() => {
          const session = createEmptyWorkspaceSession("/tmp/repo-beta/feature");
          session.layout.windows = [
            {
              id: "file-valid",
              kind: "file",
              title: "app.ts",
              x: 10,
              y: 10,
              width: 400,
              height: 300,
              zIndex: 1,
              isFocused: true,
              state: "normal",
              filePath: "/tmp/repo-beta/feature/src/app.ts",
              isDirty: false,
            },
            {
              id: "file-stale",
              kind: "file",
              title: "stale.ts",
              x: 20,
              y: 20,
              width: 400,
              height: 300,
              zIndex: 2,
              isFocused: false,
              state: "normal",
              filePath: "/tmp/repo-beta/src/outside.ts",
              isDirty: false,
            },
            {
              id: "chat-valid",
              kind: "chat",
              title: "Selected",
              x: 30,
              y: 30,
              width: 400,
              height: 300,
              zIndex: 3,
              isFocused: false,
              state: "normal",
              threadId: "thread-selected",
            },
            {
              id: "terminal-valid",
              kind: "terminal",
              title: "Terminal",
              x: 50,
              y: 50,
              width: 500,
              height: 320,
              zIndex: 5,
              isFocused: false,
              state: "normal",
              terminalId: "term-1",
              backend: "shell",
              cwd: "/tmp/repo-beta/feature",
            },
            {
              id: "terminal-stale",
              kind: "terminal",
              title: "Linked terminal",
              x: 60,
              y: 60,
              width: 500,
              height: 320,
              zIndex: 6,
              isFocused: false,
              state: "normal",
              terminalId: "term-2",
              backend: "shell",
              cwd: "/tmp/repo-beta",
            },
            {
              id: "git-stale",
              kind: "git",
              title: "Git",
              x: 70,
              y: 70,
              width: 520,
              height: 340,
              zIndex: 7,
              isFocused: false,
              state: "normal",
              repositoryPath: "/tmp/repo-beta",
            },
          ];
          session.promptDrafts = {
            "thread-selected": "resume selected thread",
            "thread-stale": "stale draft",
          };
          session.recoveryDrafts = {
            "note-1": {
              kind: "note",
              text: "keep me",
              updatedAt: 13,
            },
            "thread-selected": {
              kind: "thread",
              text: "recover me",
              updatedAt: 11,
            },
            "thread-stale": {
              kind: "thread",
              text: "stale recovery",
              updatedAt: 12,
            },
          };
          session.search = {
            query: "app",
            selectedPath: "/tmp/repo-beta/feature/src/app.ts",
          };
          session.files = {
            "/tmp/repo-beta/feature/src/app.ts": {
              filePath: "/tmp/repo-beta/feature/src/app.ts",
              scrollTop: 24,
            },
            "/tmp/repo-beta/src/outside.ts": {
              filePath: "/tmp/repo-beta/src/outside.ts",
              scrollTop: 0,
            },
          };
          return session;
        })(),
      ],
      inspectRepository: (rootPath) => {
        if (rootPath === "/tmp/repo-alpha") {
          return {
            status: "repository" as const,
            rootPath: "/tmp/repo-alpha",
            currentWorktreePath: "/tmp/repo-alpha",
            defaultBranch: "main",
            message: null,
            worktrees: [
              {
                id: "/tmp/repo-alpha",
                path: "/tmp/repo-alpha",
                isMain: true,
                isCurrent: true,
                isDetached: false,
                isPrunable: false,
                prunableReason: null,
                branch: "main",
                commit: "aaaaaaa",
                git: {
                  status: "ready",
                  branch: "main",
                  commit: "aaaaaaa",
                  hasChanges: false,
                  ahead: 0,
                  behind: 0,
                  stagedCount: 0,
                  modifiedCount: 0,
                  untrackedCount: 0,
                  message: null,
                },
              },
            ],
          };
        }

        return {
          status: "repository" as const,
          rootPath: "/tmp/repo-beta",
          currentWorktreePath: "/tmp/repo-beta/feature",
          defaultBranch: "main",
          message: null,
          worktrees: [
            {
              id: "/tmp/repo-beta",
              path: "/tmp/repo-beta",
              isMain: true,
              isCurrent: false,
              isDetached: false,
              isPrunable: false,
              prunableReason: null,
              branch: "main",
              commit: "bbbbbbb",
              git: {
                status: "ready",
                branch: "main",
                commit: "bbbbbbb",
                hasChanges: false,
                ahead: 0,
                behind: 0,
                stagedCount: 0,
                modifiedCount: 0,
                untrackedCount: 0,
                message: null,
              },
            },
            {
              id: "/tmp/repo-beta/feature",
              path: "/tmp/repo-beta/feature",
              isMain: false,
              isCurrent: true,
              isDetached: false,
              isPrunable: false,
              prunableReason: null,
              branch: "feature/runtime",
              commit: "ccccccc",
              git: {
                status: "ready",
                branch: "feature/runtime",
                commit: "ccccccc",
                hasChanges: true,
                ahead: 2,
                behind: 1,
                stagedCount: 1,
                modifiedCount: 2,
                untrackedCount: 3,
                message: null,
              },
            },
          ],
        };
      },
      listThreadsByWorktree: (worktreeId) => {
        if (worktreeId === "/tmp/repo-beta/feature") {
          return [
            {
              id: "thread-selected",
              worktreeId,
              title: "Selected thread",
              lastActivityAt: 10,
              runtimeId: "local-thread-selected",
              createdAt: 1,
              updatedAt: 1,
            },
          ];
        }

        return [];
      },
      getRuntimeState: async (thread) => ({
        threadId: thread.threadId,
        worktreePath: thread.worktreePath,
        runtimeId: `session-${thread.threadId}`,
        status: "ready",
        lastError: null,
      }),
      selectedAgentSnapshot,
    });

    expect(catalog.selection).toEqual({
      repositoryId: "/tmp/repo-beta",
      worktreeId: "/tmp/repo-beta/feature",
      threadId: "thread-selected",
    });
    expect(catalog.repositories).toHaveLength(2);
    expect(catalog.repositories[0]).toMatchObject({
      id: "/tmp/repo-alpha",
      name: "Alpha",
      defaultBranch: "main",
    });
    expect(catalog.repositories[1]).toMatchObject({
      id: "/tmp/repo-beta",
      name: "Beta Custom",
      customName: "Beta Custom",
      icon: "beaker",
      accentColor: "#ee6600",
      defaultBranch: "main",
    });
    expect(catalog.repositories[1]?.worktrees[1]).toMatchObject({
      id: "/tmp/repo-beta/feature",
      label: "feature/runtime",
      git: {
        status: "ready",
        hasChanges: true,
      },
      threads: [
        {
          id: "thread-selected",
          title: "Selected thread",
          lastActivityAt: 10,
          runtime: {
            status: "streaming",
            lastError: null,
          },
        },
      ],
    });
  });

  it("keeps an explicitly selected folder-backed repository active", async () => {
    const catalog = await buildShellCatalog({
      repositories: [
        {
          id: "/tmp/folder-workspace",
          rootPath: "/tmp/folder-workspace",
          label: "Folder Workspace",
          order: 0,
          lastSelectedWorktreeId: "/tmp/folder-workspace",
          addedAt: 1,
          updatedAt: 1,
        },
      ],
      selection: {
        repositoryId: "/tmp/folder-workspace",
        worktreeId: "/tmp/folder-workspace",
        threadId: "thread-folder",
      },
      workspaceSessions: [],
      inspectRepository: () => ({
        status: "not_repo" as const,
        message: "Not a git repository",
      }),
      listThreadsByWorktree: (worktreeId) =>
        worktreeId === "/tmp/folder-workspace"
          ? [
              {
                id: "thread-folder",
                worktreeId,
                title: "Folder thread",
                lastActivityAt: 7,
                runtimeId: "local-thread-folder",
                createdAt: 1,
                updatedAt: 1,
              },
            ]
          : [],
      getRuntimeState: async () => ({ status: "ready", lastError: null }),
    });

    expect(catalog.selection).toEqual({
      repositoryId: "/tmp/folder-workspace",
      worktreeId: "/tmp/folder-workspace",
      threadId: "thread-folder",
    });
    expect(catalog.repositories[0]).toMatchObject({
      id: "/tmp/folder-workspace",
      rootPath: "/tmp/folder-workspace",
      worktrees: [
        {
          id: "/tmp/folder-workspace",
          path: "/tmp/folder-workspace",
          isMain: true,
          isDetached: false,
          git: {
            status: "unavailable",
            message: "Git unavailable",
          },
          threads: [
            {
              id: "thread-folder",
              title: "Folder thread",
            },
          ],
        },
      ],
    });
  });
});
