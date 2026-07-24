import { describe, expect, it } from "vitest";

import { resolveInitialWorkspaceTarget } from "./initial-workspace";

describe("resolveInitialWorkspaceTarget", () => {
  it("restores lastSelectedWorktreeId when selection is empty", () => {
    const result = resolveInitialWorkspaceTarget({
      selection: {
        repositoryId: null,
        worktreeId: null,
        threadId: null,
      },
      repositories: [
        {
          id: "/tmp/repo-a",
          rootPath: "/tmp/repo-a",
          label: null,
          order: 0,
          lastSelectedWorktreeId: "/tmp/repo-a/worktrees/feature",
          addedAt: 1,
          updatedAt: 1,
        },
      ],
    });

    expect(result.preferredWorkspacePath).toBe("/tmp/repo-a/worktrees/feature");
    expect(result.fallbackWorkspacePath).toBeNull();
  });

  it("falls back to repository root when lastSelectedWorktreeId is null", () => {
    const result = resolveInitialWorkspaceTarget({
      selection: {
        repositoryId: null,
        worktreeId: null,
        threadId: null,
      },
      repositories: [
        {
          id: "/tmp/repo-a",
          rootPath: "/tmp/repo-a",
          label: null,
          order: 0,
          lastSelectedWorktreeId: null,
          addedAt: 1,
          updatedAt: 1,
        },
      ],
    });

    expect(result.preferredWorkspacePath).toBe("/tmp/repo-a");
  });

  it("prefers explicit worktree selection over lastSelectedWorktreeId", () => {
    const result = resolveInitialWorkspaceTarget({
      selection: {
        repositoryId: "/tmp/repo-a",
        worktreeId: "/tmp/repo-a/worktrees/other",
        threadId: null,
      },
      repositories: [
        {
          id: "/tmp/repo-a",
          rootPath: "/tmp/repo-a",
          label: null,
          order: 0,
          lastSelectedWorktreeId: "/tmp/repo-a/worktrees/feature",
          addedAt: 1,
          updatedAt: 1,
        },
      ],
    });

    expect(result.preferredWorkspacePath).toBe("/tmp/repo-a/worktrees/other");
    expect(result.fallbackWorkspacePath).toBe("/tmp/repo-a/worktrees/feature");
  });
});
