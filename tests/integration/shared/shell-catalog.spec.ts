import { describe, expect, it } from "vitest";
import {
  getActiveRepository,
  getActiveThread,
  getActiveWorktree,
  type ShellSnapshot,
} from "../../../packages/shared/src";

function createSnapshot(): ShellSnapshot {
  return {
    appName: "Pi Desktop",
    appVersion: "0.1.0",
    chromeVersion: "141.0.0.0",
    platform: "darwin",
    mode: "test",
    runtime: {
      agentMode: "mock",
      electronVersion: "41.0.1",
      agentDirectory: "/tmp/pi-desktop/.pi-desktop-agent",
    },
    catalog: {
      selection: {
        repositoryId: "repo-2",
        worktreeId: "repo-2/main",
        threadId: "thread-2b",
      },
      repositories: [
        {
          id: "repo-1",
          name: "alpha",
          rootPath: "/tmp/alpha",
          defaultBranch: "main",
          worktrees: [
            {
              id: "repo-1/main",
              label: "main",
              path: "/tmp/alpha",
              isMain: true,
              isDetached: false,
              git: {
                status: "ready",
                branch: "main",
                commit: "1111111",
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
                  id: "thread-1a",
                  title: "Alpha thread",
                  lastActivityAt: 1,
                  runtime: {
                    status: "ready",
                    lastError: null,
                  },
                },
              ],
            },
          ],
        },
        {
          id: "repo-2",
          name: "beta",
          rootPath: "/tmp/beta",
          defaultBranch: "main",
          worktrees: [
            {
              id: "repo-2/main",
              label: "main",
              path: "/tmp/beta",
              isMain: true,
              isDetached: false,
              git: {
                status: "ready",
                branch: "main",
                commit: "2222222",
                hasChanges: true,
                ahead: 2,
                behind: 1,
                stagedCount: 1,
                modifiedCount: 2,
                untrackedCount: 3,
                message: null,
              },
              threads: [
                {
                  id: "thread-2a",
                  title: "Beta thread A",
                  lastActivityAt: 2,
                  runtime: {
                    status: "exited",
                    lastError: null,
                  },
                },
                {
                  id: "thread-2b",
                  title: "Active beta thread",
                  lastActivityAt: 3,
                  runtime: {
                    status: "streaming",
                    lastError: null,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    capabilities: {
      supportsTurns: true,
      supportsTools: true,
      supportsActivity: true,
      supportsParallelSessions: false,
    },
  };
}

describe("shell catalog selectors", () => {
  it("returns the selected repository, worktree, and thread", () => {
    const snapshot = createSnapshot();

    expect(getActiveRepository(snapshot)?.id).toBe("repo-2");
    expect(getActiveWorktree(snapshot)?.id).toBe("repo-2/main");
    expect(getActiveThread(snapshot)?.id).toBe("thread-2b");
  });

  it("falls back to the first thread when selection is missing or stale", () => {
    const snapshot = createSnapshot();
    snapshot.catalog.selection = {
      repositoryId: "missing-repo",
      worktreeId: "missing-worktree",
      threadId: "missing-thread",
    };

    expect(getActiveRepository(snapshot)?.id).toBe("repo-1");
    expect(getActiveWorktree(snapshot)?.id).toBe("repo-1/main");
    expect(getActiveThread(snapshot)?.id).toBe("thread-1a");
  });

  it("returns null when the active worktree has no threads", () => {
    const snapshot = createSnapshot();
    const betaWorktree = snapshot.catalog.repositories[1]?.worktrees[0];
    if (!betaWorktree) {
      throw new Error("Expected beta worktree fixture");
    }

    betaWorktree.threads = [];
    snapshot.catalog.selection = {
      repositoryId: "repo-2",
      worktreeId: "repo-2/main",
      threadId: null,
    };

    expect(getActiveThread(snapshot)).toBeNull();
  });

  it("keeps selected worktree active when session has no threads", () => {
    const snapshot = createSnapshot();
    const betaWorktree = snapshot.catalog.repositories[1]?.worktrees[0];
    if (!betaWorktree) {
      throw new Error("Expected beta worktree fixture");
    }

    betaWorktree.threads = [];
    snapshot.catalog.selection = {
      repositoryId: "repo-2",
      worktreeId: "repo-2/main",
      threadId: null,
    };

    expect(getActiveRepository(snapshot)?.id).toBe("repo-2");
    expect(getActiveWorktree(snapshot)?.id).toBe("repo-2/main");
    expect(getActiveThread(snapshot)).toBeNull();
  });
});
