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
              id: "chat-stale",
              kind: "chat",
              title: "Archived",
              x: 40,
              y: 40,
              width: 400,
              height: 300,
              zIndex: 4,
              isFocused: false,
              state: "normal",
              threadId: "thread-archived",
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
          session.layout.focusedWindowId = "chat-stale";
          session.search = {
            query: "app",
            selectedPath: "/tmp/repo-beta/src/outside.ts",
          };
          session.promptDrafts = {
            "thread-selected": "resume selected thread",
            "thread-archived": "stale archived draft",
          };
          session.files = {
            "/tmp/repo-beta/feature/src/app.ts": {
              filePath: "/tmp/repo-beta/feature/src/app.ts",
              scrollTop: 24,
            },
            "/tmp/repo-beta/src/outside.ts": {
              filePath: "/tmp/repo-beta/src/outside.ts",
              scrollTop: 99,
            },
          };
          session.recoveryDrafts = {
            "thread-selected": {
              kind: "thread",
              text: "recover me",
              updatedAt: 11,
            },
            "thread-archived": {
              kind: "thread",
              text: "drop me",
              updatedAt: 12,
            },
            "note-1": {
              kind: "note",
              text: "keep me",
              updatedAt: 13,
            },
          };
          return session;
        })(),
        createEmptyWorkspaceSession("/tmp/missing-worktree"),
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
              archivedAt: null,
              lastActivityAt: 10,
              runtimeId: "local-thread-selected",
              createdAt: 1,
              updatedAt: 1,
            },
            {
              id: "thread-archived",
              worktreeId,
              title: "Archived thread",
              archivedAt: 20,
              lastActivityAt: 9,
              runtimeId: "local-thread-archived",
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
        status: thread.threadId === "thread-archived" ? "exited" : "ready",
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
          isArchived: false,
          lastActivityAt: 10,
          runtime: {
            status: "streaming",
            lastError: null,
          },
        },
        {
          id: "thread-archived",
          title: "Archived thread",
          isArchived: true,
          lastActivityAt: 9,
          runtime: {
            status: "exited",
            lastError: null,
          },
        },
      ],
    });
    expect(catalog.reconciledWorkspaceSessions).toEqual([
      {
        worktreeId: "/tmp/repo-beta/feature",
        sidebar: {
          activePanel: null,
          isCollapsed: false,
        },
        promptDrafts: {
          "thread-selected": "resume selected thread",
        },
        search: {
          query: "app",
          selectedPath: null,
        },
        files: {
          "/tmp/repo-beta/feature/src/app.ts": {
            filePath: "/tmp/repo-beta/feature/src/app.ts",
            scrollTop: 24,
          },
        },
        notes: {},
        recoveryDrafts: {
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
        },
        layout: {
          windows: [
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
              cwd: "/tmp/repo-beta/feature",
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
              repositoryPath: "/tmp/repo-beta/feature",
            },
          ],
          focusedWindowId: "chat-valid",
          nextZIndex: 8,
          snapGridSize: 24,
          zoom: 0.9,
          panX: 0,
          panY: 0,
        },
      },
    ]);
  });

  it("falls back to the first valid repository, worktree, and thread when stored selection is stale", async () => {
    const catalog = await buildShellCatalog({
      repositories: [
        {
          id: "/tmp/repo-alpha",
          rootPath: "/tmp/repo-alpha",
          label: null,
          order: 0,
          lastSelectedWorktreeId: null,
          addedAt: 1,
          updatedAt: 1,
        },
      ],
      selection: {
        repositoryId: "/tmp/missing-repo",
        worktreeId: "/tmp/missing-worktree",
        threadId: "thread-missing",
      },
      inspectRepository: () => ({
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
      }),
      listThreadsByWorktree: () => [
        {
          id: "thread-alpha",
          worktreeId: "/tmp/repo-alpha",
          title: "Recovered thread",
          archivedAt: null,
          lastActivityAt: 4,
          runtimeId: "local-thread-alpha",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      getRuntimeState: async () => ({ status: "ready", lastError: null }),
    });

    expect(catalog.selection).toEqual({
      repositoryId: "/tmp/repo-alpha",
      worktreeId: "/tmp/repo-alpha",
      threadId: "thread-alpha",
    });
  });

  it("skips repositories without worktrees when reconciling stale selection", async () => {
    const catalog = await buildShellCatalog({
      repositories: [
        {
          id: "/tmp/repo-empty",
          rootPath: "/tmp/repo-empty",
          label: null,
          order: 0,
          lastSelectedWorktreeId: null,
          addedAt: 1,
          updatedAt: 1,
        },
        {
          id: "/tmp/repo-valid",
          rootPath: "/tmp/repo-valid",
          label: null,
          order: 1,
          lastSelectedWorktreeId: null,
          addedAt: 2,
          updatedAt: 2,
        },
      ],
      selection: {
        repositoryId: "/tmp/missing-repo",
        worktreeId: "/tmp/missing-worktree",
        threadId: "thread-missing",
      },
      inspectRepository: (rootPath) =>
        rootPath === "/tmp/repo-empty"
          ? {
              status: "repository" as const,
              rootPath,
              currentWorktreePath: "/tmp/repo-empty",
              defaultBranch: "main",
              message: null,
              worktrees: [],
            }
          : {
              status: "repository" as const,
              rootPath,
              currentWorktreePath: "/tmp/repo-valid/main",
              defaultBranch: "main",
              message: null,
              worktrees: [
                {
                  id: "/tmp/repo-valid/main",
                  path: "/tmp/repo-valid/main",
                  isMain: true,
                  isCurrent: true,
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
              ],
            },
      listThreadsByWorktree: (worktreeId) =>
        worktreeId === "/tmp/repo-valid/main"
          ? [
              {
                id: "thread-valid",
                worktreeId,
                title: "Recovered thread",
                archivedAt: null,
                lastActivityAt: 4,
                runtimeId: "local-thread-valid",
                createdAt: 1,
                updatedAt: 1,
              },
            ]
          : [],
      getRuntimeState: async () => ({ status: "ready", lastError: null }),
    });

    expect(catalog.selection).toEqual({
      repositoryId: "/tmp/repo-valid",
      worktreeId: "/tmp/repo-valid/main",
      threadId: "thread-valid",
    });
  });

  it("keeps an explicitly selected folder-backed repository active", async () => {
    const catalog = await buildShellCatalog({
      repositories: [
        {
          id: "/tmp/folder-workspace",
          rootPath: "/tmp/folder-workspace",
          label: null,
          order: 0,
          lastSelectedWorktreeId: null,
          addedAt: 1,
          updatedAt: 1,
        },
        {
          id: "/tmp/repo-valid",
          rootPath: "/tmp/repo-valid",
          label: null,
          order: 1,
          lastSelectedWorktreeId: null,
          addedAt: 2,
          updatedAt: 2,
        },
      ],
      selection: {
        repositoryId: "/tmp/folder-workspace",
        worktreeId: "/tmp/folder-workspace",
        threadId: "thread-folder",
      },
      inspectRepository: (rootPath) =>
        rootPath === "/tmp/folder-workspace"
          ? {
              status: "not_repo" as const,
              message: null,
            }
          : {
              status: "repository" as const,
              rootPath,
              currentWorktreePath: "/tmp/repo-valid/main",
              defaultBranch: "main",
              message: null,
              worktrees: [
                {
                  id: "/tmp/repo-valid/main",
                  path: "/tmp/repo-valid/main",
                  isMain: true,
                  isCurrent: true,
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
              ],
            },
      listThreadsByWorktree: (worktreeId) =>
        worktreeId === "/tmp/folder-workspace"
          ? [
              {
                id: "thread-folder",
                worktreeId,
                title: "Folder thread",
                archivedAt: null,
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
              isArchived: false,
            },
          ],
        },
      ],
    });
  });

  it("keeps selected session active when worktree only has archived threads", async () => {
    const session = createEmptyWorkspaceSession("/tmp/repo-archived/main");
    session.layout.windows = [
      {
        id: "git-window",
        kind: "git",
        title: "Git",
        x: 10,
        y: 10,
        width: 320,
        height: 240,
        zIndex: 1,
        isFocused: true,
        state: "normal",
        repositoryPath: "/tmp/repo-archived/main",
      },
    ];

    const catalog = await buildShellCatalog({
      repositories: [
        {
          id: "/tmp/repo-archived",
          rootPath: "/tmp/repo-archived",
          label: null,
          order: 0,
          lastSelectedWorktreeId: null,
          addedAt: 1,
          updatedAt: 1,
        },
      ],
      selection: {
        repositoryId: "/tmp/repo-archived",
        worktreeId: "/tmp/repo-archived/main",
        threadId: "thread-archived",
      },
      workspaceSessions: [session],
      inspectRepository: (rootPath) => ({
        status: "repository" as const,
        rootPath,
        currentWorktreePath: "/tmp/repo-archived/main",
        defaultBranch: "main",
        message: null,
        worktrees: [
          {
            id: "/tmp/repo-archived/main",
            path: "/tmp/repo-archived/main",
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
      }),
      listThreadsByWorktree: (worktreeId) => [
        {
          id: "thread-archived",
          worktreeId,
          title: "Archived thread",
          archivedAt: 10,
          lastActivityAt: 9,
          runtimeId: "local-thread-archived",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      getRuntimeState: async () => ({ status: "exited", lastError: null }),
    });

    expect(catalog.selection).toEqual({
      repositoryId: "/tmp/repo-archived",
      worktreeId: "/tmp/repo-archived/main",
      threadId: null,
    });
    expect(catalog.repositories[0]?.worktrees[0]?.threads).toEqual([
      expect.objectContaining({
        id: "thread-archived",
        isArchived: true,
      }),
    ]);
    expect(catalog.reconciledWorkspaceSessions).toEqual([
      expect.objectContaining({
        worktreeId: "/tmp/repo-archived/main",
        layout: expect.objectContaining({
          windows: [
            expect.objectContaining({
              id: "git-window",
              kind: "git",
            }),
          ],
        }),
      }),
    ]);
  });
});
