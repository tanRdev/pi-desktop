import { describe, expect, it } from "vitest";
import type { GitRepositoryInspection } from "../git-worktree-service";
import {
  buildInspectionCacheEntries,
  createNotRepositoryInspection,
  createUnavailableInspection,
} from "./inspection-outcomes";

describe("inspection outcome helpers", () => {
  it("creates a not-repo inspection with a null message", () => {
    expect(createNotRepositoryInspection()).toEqual({
      status: "not_repo",
      message: null,
    });
  });

  it("creates an unavailable inspection with the provided message", () => {
    expect(createUnavailableInspection("git unavailable")).toEqual({
      status: "unavailable",
      message: "git unavailable",
    });
  });

  it("builds unique cache entries for the command, root, and current paths", () => {
    const inspection: GitRepositoryInspection = {
      status: "repository",
      rootPath: "/repo",
      currentWorktreePath: "/repo/worktrees/feature",
      defaultBranch: "main",
      worktrees: [],
      message: null,
    };

    expect(
      buildInspectionCacheEntries({
        cacheKey: "/repo",
        inspection,
        updatedAt: 123,
      }),
    ).toEqual([
      [
        "/repo",
        {
          inspection,
          updatedAt: 123,
        },
      ],
      [
        "/repo/worktrees/feature",
        {
          inspection,
          updatedAt: 123,
        },
      ],
    ]);
  });
});
