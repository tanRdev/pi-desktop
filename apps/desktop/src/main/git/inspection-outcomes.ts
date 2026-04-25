import type { GitRepositoryInspection } from "../git-worktree-service";

export type InspectionCacheEntry = {
  inspection: GitRepositoryInspection;
  updatedAt: number;
};

export function createNotRepositoryInspection(): GitRepositoryInspection {
  return {
    status: "not_repo",
    message: null,
  };
}

export function createUnavailableInspection(
  message: string,
): GitRepositoryInspection {
  return {
    status: "unavailable",
    message,
  };
}

export function buildInspectionCacheEntries(options: {
  cacheKey: string;
  inspection: GitRepositoryInspection;
  updatedAt: number;
}): Array<[string, InspectionCacheEntry]> {
  const entries = new Map<string, InspectionCacheEntry>();
  const cacheEntry = {
    inspection: options.inspection,
    updatedAt: options.updatedAt,
  };

  entries.set(options.cacheKey, cacheEntry);

  if (options.inspection.rootPath) {
    entries.set(options.inspection.rootPath, cacheEntry);
  }

  if (options.inspection.currentWorktreePath) {
    entries.set(options.inspection.currentWorktreePath, cacheEntry);
  }

  return Array.from(entries.entries());
}
