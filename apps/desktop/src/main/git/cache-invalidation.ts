import type { LruMap } from "../lru-map";
import { normalizePathId } from "./path-utils";

type TimestampedCacheEntry = {
  updatedAt: number;
};

type ClearCachesForPathOptions<
  InspectionEntry extends TimestampedCacheEntry,
  StatusEntry extends TimestampedCacheEntry,
> = {
  targetPath: string;
  now: number;
  inspectionCache: LruMap<string, InspectionEntry>;
  inspectionTtl: number;
  repositoryStatusCache: LruMap<string, StatusEntry>;
  statusTtl: number;
};

type ClearAllCachesOptions<
  InspectionEntry extends TimestampedCacheEntry,
  StatusEntry extends TimestampedCacheEntry,
> = {
  inspectionCache: LruMap<string, InspectionEntry>;
  repositoryStatusCache: LruMap<string, StatusEntry>;
};

function clearExpiredEntries<Entry extends TimestampedCacheEntry>(options: {
  cache: LruMap<string, Entry>;
  now: number;
  ttl: number;
}): void {
  const expirationWindow = options.ttl * 2;

  for (const [key, entry] of options.cache) {
    if (options.now - entry.updatedAt > expirationWindow) {
      options.cache.delete(key);
    }
  }
}

export function clearGitWorktreeCachesForPath<
  InspectionEntry extends TimestampedCacheEntry,
  StatusEntry extends TimestampedCacheEntry,
>(options: ClearCachesForPathOptions<InspectionEntry, StatusEntry>): void {
  const normalizedTargetPath = normalizePathId(options.targetPath);

  options.inspectionCache.delete(normalizedTargetPath);
  clearExpiredEntries({
    cache: options.inspectionCache,
    now: options.now,
    ttl: options.inspectionTtl,
  });

  options.repositoryStatusCache.delete(normalizedTargetPath);
  clearExpiredEntries({
    cache: options.repositoryStatusCache,
    now: options.now,
    ttl: options.statusTtl,
  });
}

export function clearAllGitWorktreeCaches<
  InspectionEntry extends TimestampedCacheEntry,
  StatusEntry extends TimestampedCacheEntry,
>(options: ClearAllCachesOptions<InspectionEntry, StatusEntry>): void {
  options.inspectionCache.clear();
  options.repositoryStatusCache.clear();
}
