import { useMemo } from "react";

/**
 * A single candidate file in a flat quick-open list.
 *
 * Consumers pass in a pre-flattened list (e.g. from a recursive directory
 * walk on the main process) — this hook does NOT perform I/O. It is pure
 * data → ranked results.
 */
export interface QuickOpenFile {
  /** Absolute or workspace-relative path — this is the value returned on select. */
  path: string;
  /** Display name (usually basename). Used for matching priority. */
  name: string;
  /** Optional relative path to show as a secondary line. */
  relativePath?: string;
}

export interface QuickOpenMatch {
  file: QuickOpenFile;
  /** Indices into `name` that matched the query. Useful for UI highlighting. */
  nameMatchIndices: number[];
  /** Indices into `path` (or `relativePath` when provided) that matched. */
  pathMatchIndices: number[];
  /** Ranking score. Higher is better. */
  score: number;
}

export interface UseQuickOpenOptions {
  /** Maximum number of results to return. Defaults to 50. */
  limit?: number;
}

export interface UseQuickOpenResult {
  /** Ranked matches for the given query. */
  matches: QuickOpenMatch[];
}

/** Case-insensitive subsequence search that returns match indices. */
function subsequenceMatch(
  haystack: string,
  needle: string,
): { indices: number[]; tightness: number } | null {
  if (needle.length === 0) return { indices: [], tightness: 0 };
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  const indices: number[] = [];
  let hi = 0;
  let ni = 0;
  while (hi < h.length && ni < n.length) {
    if (h[hi] === n[ni]) {
      indices.push(hi);
      ni += 1;
    }
    hi += 1;
  }
  if (ni < n.length) return null;

  // Tightness: smaller span between first and last match = tighter = better.
  const first = indices[0] ?? 0;
  const last = indices[indices.length - 1] ?? 0;
  const span = last - first + 1;
  // Bonus for starting at index 0 (prefix match).
  const prefixBonus = first === 0 ? 50 : 0;
  // Bonus when matched chars are contiguous.
  const contiguousBonus = span === needle.length ? 40 : 0;
  const tightness = 100 - span + prefixBonus + contiguousBonus;
  return { indices, tightness };
}

function scoreFile(file: QuickOpenFile, query: string): QuickOpenMatch | null {
  if (query.length === 0) {
    return {
      file,
      nameMatchIndices: [],
      pathMatchIndices: [],
      score: 0,
    };
  }

  const nameHit = subsequenceMatch(file.name, query);
  const pathTarget = file.relativePath ?? file.path;
  const pathHit = subsequenceMatch(pathTarget, query);

  if (!nameHit && !pathHit) return null;

  // Prefer name matches strongly.
  let score = 0;
  if (nameHit) score += 1000 + nameHit.tightness;
  if (pathHit) score += 100 + pathHit.tightness;
  // Shorter names rank higher when scores tie.
  score -= file.name.length * 0.1;

  return {
    file,
    nameMatchIndices: nameHit?.indices ?? [],
    pathMatchIndices: pathHit?.indices ?? [],
    score,
  };
}

/**
 * Pure fuzzy quick-open hook. Takes a flat file list and a query,
 * returns ranked matches. No UI, no I/O.
 */
export function useQuickOpen(
  files: QuickOpenFile[],
  query: string,
  options: UseQuickOpenOptions = {},
): UseQuickOpenResult {
  const limit = options.limit ?? 50;

  const matches = useMemo(() => {
    const trimmed = query.trim();
    const scored: QuickOpenMatch[] = [];
    for (const file of files) {
      const match = scoreFile(file, trimmed);
      if (match !== null) scored.push(match);
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }, [files, query, limit]);

  return { matches };
}
