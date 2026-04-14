import path from "node:path";
import type { GitRepositoryInspection } from "../git-worktree-service";
import type { ResolvedRepositoryInspection } from "./thread-context";

export function resolveWorkspaceInspection(
  targetPath: string,
  inspection: GitRepositoryInspection,
): ResolvedRepositoryInspection | null {
  if (
    inspection.status === "repository" &&
    inspection.rootPath &&
    inspection.currentWorktreePath &&
    inspection.worktrees
  ) {
    return {
      rootPath: inspection.rootPath,
      currentWorktreePath: inspection.currentWorktreePath,
      worktrees: inspection.worktrees,
      defaultBranch: inspection.defaultBranch ?? null,
    };
  }

  if (inspection.status === "not_repo") {
    const workspacePath = path.resolve(targetPath);

    return {
      rootPath: workspacePath,
      currentWorktreePath: workspacePath,
      worktrees: [],
      defaultBranch: null,
    };
  }

  return null;
}
