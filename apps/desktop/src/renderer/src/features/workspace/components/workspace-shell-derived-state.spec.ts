import type {
  GitRepositoryStatus,
  RepositorySnapshot,
  ShellGitSnapshot,
} from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";
import type { ContextWindow } from "../workspace-pane-state";
import { buildWorkspaceShellDerivedState } from "./workspace-shell-derived-state";

function createRepository(): RepositorySnapshot {
  return {
    id: "repo-1",
    name: "Alpha Workspace",
    customName: null,
    icon: null,
    accentColor: null,
    rootPath: "/tmp/alpha-workspace",
    defaultBranch: "main",
    worktrees: [
      {
        id: "worktree-1",
        label: "main",
        path: "/tmp/alpha-workspace",
        isMain: true,
        isDetached: false,
        git: {
          status: "ready",
          branch: "main",
          commit: "abc123",
          hasChanges: false,
          ahead: 0,
          behind: 0,
          stagedCount: 0,
          modifiedCount: 0,
          untrackedCount: 0,
          message: null,
        },
        threads: [],
      },
    ],
  };
}

function createGitStatus(
  overrides: Partial<GitRepositoryStatus> = {},
): GitRepositoryStatus {
  return {
    repositoryPath: "/tmp/alpha-workspace",
    branch: "main",
    commit: "abc123",
    upstreamBranch: "origin/main",
    summary: {
      status: "ready",
      branch: "main",
      commit: "abc123",
      hasChanges: false,
      ahead: 0,
      behind: 0,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: null,
    },
    stagedChanges: [],
    unstagedChanges: [],
    conflictedChanges: [],
    ...overrides,
  };
}

function createShellGit(
  overrides: Partial<ShellGitSnapshot> = {},
): ShellGitSnapshot {
  return {
    status: "repository",
    branch: "main",
    ahead: 0,
    behind: 0,
    ...overrides,
  };
}

describe("buildWorkspaceShellDerivedState", () => {
  it("derives the active worktree, selected file window, and commit flags", () => {
    const repository = createRepository();
    const contextWindows: ContextWindow[] = [
      {
        id: "terminal-window-1",
        kind: "terminal",
        title: "Terminal",
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        zIndex: 1,
        isFocused: false,
        state: "normal",
        terminalId: "terminal-1",
        backend: "shell",
        cwd: "/tmp/alpha-workspace",
      },
      {
        id: "file-window-1",
        kind: "file",
        title: "workspace-shell.tsx",
        x: 10,
        y: 20,
        width: 600,
        height: 400,
        zIndex: 2,
        isFocused: true,
        state: "normal",
        filePath: "/tmp/alpha-workspace/workspace-shell.tsx",
        isDirty: false,
        encoding: "utf-8",
        isReadOnly: false,
      },
    ];

    const derivedState = buildWorkspaceShellDerivedState({
      activeRepository: repository,
      activeWorktreeId: "worktree-1",
      activeThreadId: "thread-1",
      activeGitRepositoryStatus: createGitStatus({
        stagedChanges: [
          {
            path: "src/app.tsx",
            status: "modified",
            indexStatus: "modified",
            worktreeStatus: null,
          },
        ],
      }),
      shellGit: createShellGit({ ahead: 2 }),
      contextWindows,
      selectedContextSurface: "file-window-1",
    });

    expect(derivedState.projectName).toBe("Alpha Workspace");
    expect(derivedState.activeWorktree?.id).toBe("worktree-1");
    expect(derivedState.hasActiveThread).toBe(true);
    expect(derivedState.hasChangesToCommit).toBe(true);
    expect(derivedState.hasCommitsToPush).toBe(true);
    expect(derivedState.selectedFileWindow).toEqual(
      expect.objectContaining({
        id: "file-window-1",
        filePath: "/tmp/alpha-workspace/workspace-shell.tsx",
      }),
    );
  });

  it("falls back to defaults when no active repository selections are available", () => {
    const derivedState = buildWorkspaceShellDerivedState({
      activeRepository: null,
      activeWorktreeId: null,
      activeThreadId: null,
      activeGitRepositoryStatus: null,
      shellGit: null,
      contextWindows: [],
      selectedContextSurface: null,
    });

    expect(derivedState.projectName).toBe("Pi");
    expect(derivedState.activeWorktree).toBeNull();
    expect(derivedState.hasActiveThread).toBe(false);
    expect(derivedState.hasChangesToCommit).toBe(false);
    expect(derivedState.hasCommitsToPush).toBe(false);
    expect(derivedState.selectedFileWindow).toBeNull();
  });
});
