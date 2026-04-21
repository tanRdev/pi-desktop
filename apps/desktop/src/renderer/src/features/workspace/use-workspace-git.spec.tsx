// @vitest-environment jsdom
import type { GitRepositoryStatus } from "@pi-desktop/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/lib/toast";
import { createWorktree } from "../../../../test/factories";
import {
  installMockPiDesktop,
  uninstallMockPiDesktop,
} from "../../../../test/mock-pi-desktop";
import { useWorkspaceGit } from "./use-workspace-git";

function requireNamespace(
  namespace: Record<string, ReturnType<typeof vi.fn>> | undefined,
  label: string,
) {
  if (!namespace) {
    throw new Error(`Missing mock namespace: ${label}`);
  }

  return namespace;
}

function makeRepoStatus(
  overrides: Partial<GitRepositoryStatus> = {},
): GitRepositoryStatus {
  return {
    repositoryPath: "/tmp/repo",
    branch: "main",
    commit: "abc1234",
    upstreamBranch: "origin/main",
    summary: createWorktree().git,
    stagedChanges: [],
    unstagedChanges: [],
    conflictedChanges: [],
    ...overrides,
  };
}

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("useWorkspaceGit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    uninstallMockPiDesktop();
  });

  it("loads git status on mount and refreshes it on demand", async () => {
    const reload = vi.fn(async () => undefined);
    const initialStatus = makeRepoStatus();
    const refreshedStatus = makeRepoStatus({ branch: "feature/refreshed" });
    const api = installMockPiDesktop({
      git: {
        getRepositoryStatus: vi.fn(
          async (_repositoryPath: string, options?: { force?: boolean }) =>
            options?.force ? refreshedStatus : initialStatus,
        ),
      },
    });
    const git = requireNamespace(api.git, "git");

    const { result } = renderHook(() =>
      useWorkspaceGit({ activeWorktreePath: "/tmp/repo", reload }),
    );

    await waitFor(() => {
      expect(result.current.activeGitRepositoryStatus).toEqual(initialStatus);
    });

    await act(async () => {
      await result.current.refreshGitRepositoryStatus();
    });

    expect(git.getRepositoryStatus).toHaveBeenNthCalledWith(
      1,
      "/tmp/repo",
      undefined,
    );
    expect(git.getRepositoryStatus).toHaveBeenNthCalledWith(2, "/tmp/repo", {
      force: true,
    });
    expect(result.current.activeGitRepositoryStatus).toEqual(refreshedStatus);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("stages a file and updates the local git status", async () => {
    const reload = vi.fn(async () => undefined);
    const initialStatus = makeRepoStatus();
    const stagedStatus = makeRepoStatus({
      stagedChanges: [
        {
          path: "src/app.tsx",
          status: "modified",
          indexStatus: "modified",
          worktreeStatus: null,
        },
      ],
      summary: createWorktree({
        git: {
          status: "ready",
          stagedCount: 1,
          modifiedCount: 0,
          untrackedCount: 0,
          hasChanges: true,
        },
      }).git,
    });
    const api = installMockPiDesktop({
      git: {
        getRepositoryStatus: vi.fn(async () => initialStatus),
        stageFile: vi.fn(async () => stagedStatus),
      },
    });
    const git = requireNamespace(api.git, "git");

    const { result } = renderHook(() =>
      useWorkspaceGit({ activeWorktreePath: "/tmp/repo", reload }),
    );

    await waitFor(() => {
      expect(result.current.activeGitRepositoryStatus).toEqual(initialStatus);
    });

    await act(async () => {
      await result.current.stageGitFile("src/app.tsx");
    });

    expect(git.stageFile).toHaveBeenCalledWith("/tmp/repo", "src/app.tsx");
    expect(result.current.activeGitRepositoryStatus).toEqual(stagedStatus);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("File staged");
  });

  it("commits and pushes with the current message, then clears it", async () => {
    const reload = vi.fn(async () => undefined);
    const initialStatus = makeRepoStatus();
    const committedStatus = makeRepoStatus({ commit: "def5678" });
    const pushedStatus = makeRepoStatus({
      commit: "def5678",
      summary: createWorktree({
        git: {
          status: "ready",
          ahead: 0,
          behind: 0,
          stagedCount: 0,
          modifiedCount: 0,
          untrackedCount: 0,
          hasChanges: false,
        },
      }).git,
    });
    const api = installMockPiDesktop({
      git: {
        getRepositoryStatus: vi.fn(async () => initialStatus),
        commit: vi.fn(async () => committedStatus),
        push: vi.fn(async () => pushedStatus),
      },
    });
    const git = requireNamespace(api.git, "git");

    const { result } = renderHook(() =>
      useWorkspaceGit({ activeWorktreePath: "/tmp/repo", reload }),
    );

    await waitFor(() => {
      expect(result.current.activeGitRepositoryStatus).toEqual(initialStatus);
    });

    act(() => {
      result.current.setGitCommitMessage("feat: improve architecture");
    });

    await act(async () => {
      await result.current.commitAndPushGitChanges();
    });

    expect(git.commit).toHaveBeenCalledWith(
      "/tmp/repo",
      "feat: improve architecture",
    );
    expect(git.push).toHaveBeenCalledWith("/tmp/repo");
    expect(result.current.activeGitRepositoryStatus).toEqual(pushedStatus);
    expect(result.current.gitCommitMessage).toBe("");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Committed and pushed");
  });
});
