import { describe, expect, it } from "vitest";
import type { AgentSnapshot } from "../../../packages/shared/src";
import { buildShellCatalog } from "../../../apps/desktop/src/main/shell-catalog-builder";

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
              runtimeSessionName: "pidesk-thread-selected",
              createdAt: 1,
              updatedAt: 1,
            },
            {
              id: "thread-archived",
              worktreeId,
              title: "Archived thread",
              archivedAt: 20,
              lastActivityAt: 9,
              runtimeSessionName: "pidesk-thread-archived",
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
        sessionName: `session-${thread.threadId}`,
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
      name: "repo-beta",
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
          runtimeSessionName: "pidesk-thread-alpha",
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
});
