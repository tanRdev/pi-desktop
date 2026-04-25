import { describe, expect, it } from "vitest";
import { LruMap } from "../lru-map";
import {
  clearAllGitWorktreeCaches,
  clearGitWorktreeCachesForPath,
} from "./cache-invalidation";
import { normalizePathId } from "./path-utils";

describe("git cache invalidation helpers", () => {
  it("removes the requested path and stale cache entries", () => {
    const inspectionCache = new LruMap<string, { updatedAt: number }>(10);
    const repositoryStatusCache = new LruMap<string, { updatedAt: number }>(10);
    const now = 10_000;
    const targetPath = "/repo/worktree";
    const normalizedTargetPath = normalizePathId(targetPath);

    inspectionCache.set(normalizedTargetPath, { updatedAt: now });
    inspectionCache.set("fresh-inspection", { updatedAt: now - 50 });
    inspectionCache.set("stale-inspection", { updatedAt: now - 4_001 });

    repositoryStatusCache.set(normalizedTargetPath, { updatedAt: now });
    repositoryStatusCache.set("fresh-status", { updatedAt: now - 50 });
    repositoryStatusCache.set("stale-status", { updatedAt: now - 4_001 });

    clearGitWorktreeCachesForPath({
      targetPath,
      now,
      inspectionCache,
      inspectionTtl: 2_000,
      repositoryStatusCache,
      statusTtl: 2_000,
    });

    expect([...inspectionCache.keys()]).toEqual(["fresh-inspection"]);
    expect([...repositoryStatusCache.keys()]).toEqual(["fresh-status"]);
  });

  it("clears both caches entirely", () => {
    const inspectionCache = new LruMap<string, { updatedAt: number }>(10);
    const repositoryStatusCache = new LruMap<string, { updatedAt: number }>(10);

    inspectionCache.set("inspection", { updatedAt: 1 });
    repositoryStatusCache.set("status", { updatedAt: 1 });

    clearAllGitWorktreeCaches({ inspectionCache, repositoryStatusCache });

    expect(inspectionCache.size).toBe(0);
    expect(repositoryStatusCache.size).toBe(0);
  });
});
