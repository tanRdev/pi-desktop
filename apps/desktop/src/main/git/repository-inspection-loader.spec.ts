import { describe, expect, it, vi } from "vitest";

import {
  loadRepositoryInspection,
  loadRepositoryInspectionAsync,
} from "./repository-inspection-loader";

type ParsedWorktree = {
  path: string;
  head: string | null;
  branchRef: string | null;
  detached: boolean;
  prunableReason: string | null;
};

function createParsedWorktree(
  overrides: Partial<ParsedWorktree> = {},
): ParsedWorktree {
  return {
    path: "/repo/main",
    head: "abcdef1234567890",
    branchRef: "refs/heads/main",
    detached: false,
    prunableReason: null,
    ...overrides,
  };
}

function createWorktreeSummary(path: string, isMain: boolean) {
  const branch = isMain ? "main" : "feature/test";
  const commit = isMain ? "abcdef1" : "bcdefa2";

  return {
    id: path,
    path,
    isMain,
    isCurrent: isMain,
    isDetached: false,
    isPrunable: false,
    prunableReason: null,
    branch,
    commit,
    git: {
      status: "ready" as const,
      branch,
      commit,
      hasChanges: !isMain,
      ahead: isMain ? 0 : 1,
      behind: 0,
      stagedCount: 0,
      modifiedCount: isMain ? 0 : 1,
      untrackedCount: 0,
      message: null,
    },
  };
}

describe("repository inspection loaders", () => {
  it("returns a not-repo inspection when no current worktree root is resolved", () => {
    const parseWorktreeList = vi.fn();
    const inspectWorktree = vi.fn();
    const detectDefaultBranch = vi.fn();
    const buildInspection = vi.fn();

    const inspection = loadRepositoryInspection({
      targetPath: "/repo",
      resolveCommandCwd: vi.fn((targetPath: string) => targetPath),
      resolveCurrentWorktreeRoot: vi.fn(() => null),
      resolveCommonGitDir: vi.fn(),
      runWorktreeList: vi.fn(),
      parseWorktreeList,
      inspectWorktree,
      detectDefaultBranch,
      buildInspection,
    });

    expect(inspection).toEqual({
      status: "not_repo",
      message: null,
    });
    expect(parseWorktreeList).not.toHaveBeenCalled();
    expect(inspectWorktree).not.toHaveBeenCalled();
    expect(detectDefaultBranch).not.toHaveBeenCalled();
    expect(buildInspection).not.toHaveBeenCalled();
  });

  it("loads and sorts repository inspection data from the extracted sync seam", () => {
    const parsedWorktrees = [
      createParsedWorktree({
        path: "/repo/worktrees/feature",
        head: "bcdefa2345678901",
        branchRef: "refs/heads/feature/test",
      }),
      createParsedWorktree(),
    ];
    const worktreeSummaries = new Map(
      parsedWorktrees.map((entry) => [
        entry.path,
        createWorktreeSummary(entry.path, entry.path === "/repo/main"),
      ]),
    );
    const inspectWorktree = vi.fn((entry: ParsedWorktree) => {
      const summary = worktreeSummaries.get(entry.path);
      if (!summary) {
        throw new Error(`Missing worktree summary for ${entry.path}`);
      }

      return summary;
    });
    const buildInspection = vi.fn((input) => ({
      status: "repository" as const,
      rootPath: "/repo/main",
      currentWorktreePath: input.currentWorktreeRoot,
      defaultBranch: input.defaultBranch,
      worktrees: input.worktrees,
      message: null,
    }));

    const inspection = loadRepositoryInspection({
      targetPath: "/repo",
      resolveCommandCwd: vi.fn((targetPath: string) => targetPath),
      resolveCurrentWorktreeRoot: vi.fn(() => "/repo/main"),
      resolveCommonGitDir: vi.fn(() => "/repo/.git"),
      runWorktreeList: vi.fn(() => ({
        status: 0,
        stdout: "worktree list",
        stderr: "",
        error: null,
      })),
      parseWorktreeList: vi.fn(() => parsedWorktrees),
      inspectWorktree,
      detectDefaultBranch: vi.fn(() => "main"),
      buildInspection,
    });

    expect(inspection).toMatchObject({
      status: "repository",
      currentWorktreePath: "/repo/main",
      defaultBranch: "main",
      worktrees: [
        createWorktreeSummary("/repo/main", true),
        createWorktreeSummary("/repo/worktrees/feature", false),
      ],
    });
    expect(inspectWorktree).toHaveBeenNthCalledWith(
      1,
      parsedWorktrees[0],
      "/repo/main",
      "/repo/.git",
    );
    expect(inspectWorktree).toHaveBeenNthCalledWith(
      2,
      parsedWorktrees[1],
      "/repo/main",
      "/repo/.git",
    );
    expect(buildInspection).toHaveBeenCalledWith({
      currentWorktreeRoot: "/repo/main",
      defaultBranch: "main",
      worktrees: [
        createWorktreeSummary("/repo/main", true),
        createWorktreeSummary("/repo/worktrees/feature", false),
      ],
    });
  });

  it("mirrors the sync loading flow in the async seam", async () => {
    const parsedWorktrees = [
      createParsedWorktree({
        path: "/repo/worktrees/feature",
        head: "bcdefa2345678901",
        branchRef: "refs/heads/feature/test",
      }),
      createParsedWorktree(),
    ];
    const inspectWorktreeAsync = vi.fn(
      async (
        entry: ParsedWorktree,
        _currentWorktreeRoot: string,
        _commonGitDir: string,
      ) => createWorktreeSummary(entry.path, entry.path === "/repo/main"),
    );
    const buildInspection = vi.fn((input) => ({
      status: "repository" as const,
      rootPath: "/repo/main",
      currentWorktreePath: input.currentWorktreeRoot,
      defaultBranch: input.defaultBranch,
      worktrees: input.worktrees,
      currentGit: {
        status: "repository" as const,
        rootPath: "/repo/main",
        branch: "main",
        commit: "abcdef1",
        hasChanges: false,
        ahead: 0,
        behind: 0,
        stagedCount: 0,
        modifiedCount: 0,
        untrackedCount: 0,
        message: null,
      },
      message: null,
    }));

    await expect(
      loadRepositoryInspectionAsync({
        targetPath: "/repo",
        resolveCommandCwd: vi.fn((targetPath: string) => targetPath),
        resolveCurrentWorktreeRoot: vi.fn(async () => "/repo/main"),
        resolveCommonGitDir: vi.fn(async () => "/repo/.git"),
        runWorktreeList: vi.fn(async () => ({
          status: 0,
          stdout: "worktree list",
          stderr: "",
          error: null,
        })),
        parseWorktreeList: vi.fn(() => parsedWorktrees),
        inspectWorktree: inspectWorktreeAsync,
        detectDefaultBranch: vi.fn(async () => "main"),
        buildInspection,
      }),
    ).resolves.toMatchObject({
      status: "repository",
      currentWorktreePath: "/repo/main",
      defaultBranch: "main",
      worktrees: [
        createWorktreeSummary("/repo/main", true),
        createWorktreeSummary("/repo/worktrees/feature", false),
      ],
    });
    expect(inspectWorktreeAsync).toHaveBeenNthCalledWith(
      1,
      parsedWorktrees[0],
      "/repo/main",
      "/repo/.git",
    );
    expect(inspectWorktreeAsync).toHaveBeenNthCalledWith(
      2,
      parsedWorktrees[1],
      "/repo/main",
      "/repo/.git",
    );
  });

  it("surfaces worktree listing failures through the helper seam", async () => {
    const error = new Error("git exploded");

    const syncInspection = loadRepositoryInspection({
      targetPath: "/repo",
      resolveCommandCwd: vi.fn((targetPath: string) => targetPath),
      resolveCurrentWorktreeRoot: vi.fn(() => "/repo/main"),
      resolveCommonGitDir: vi.fn(() => "/repo/.git"),
      runWorktreeList: vi.fn(() => ({
        status: 0,
        stdout: "",
        stderr: "",
        error,
      })),
      parseWorktreeList: vi.fn(),
      inspectWorktree: vi.fn(),
      detectDefaultBranch: vi.fn(),
      buildInspection: vi.fn(),
    });

    await expect(
      loadRepositoryInspectionAsync({
        targetPath: "/repo",
        resolveCommandCwd: vi.fn((targetPath: string) => targetPath),
        resolveCurrentWorktreeRoot: vi.fn(async () => "/repo/main"),
        resolveCommonGitDir: vi.fn(async () => "/repo/.git"),
        runWorktreeList: vi.fn(async () => ({
          status: 0,
          stdout: "",
          stderr: "",
          error,
        })),
        parseWorktreeList: vi.fn(),
        inspectWorktree: vi.fn(),
        detectDefaultBranch: vi.fn(),
        buildInspection: vi.fn(),
      }),
    ).resolves.toEqual(syncInspection);

    expect(syncInspection).toEqual({
      status: "unavailable",
      message: "git exploded",
    });
  });
});
