/**
 * Lightweight fuzzy scorer.
 *
 * Requirements:
 * - Pure, no deps.
 * - Returns `{ score, indices }` where higher score = better match.
 * - A `null` result means the query did not match at all.
 * - Empty query matches everything with a neutral score of 0.
 *
 * Scoring heuristics (roughly inspired by VSCode / fzf):
 * - +16 per character matched
 * - +18 bonus when the match starts at position 0
 * - +8 bonus when the match is on a word boundary (start, after space/-/_/./\/)
 * - +6 bonus when the match is a camelCase boundary (lower -> Upper)
 * - +4 bonus for consecutive matches
 * - -1 penalty per skipped character inside the matched range
 * - Exact (case-insensitive) substring gets a big bonus
 */

export type FuzzyResult = {
  score: number;
  indices: ReadonlyArray<number>;
};

function isWordBoundary(target: string, index: number): boolean {
  if (index === 0) return true;
  const prev = target.charCodeAt(index - 1);
  // space, -, _, ., /, \
  return (
    prev === 32 ||
    prev === 45 ||
    prev === 95 ||
    prev === 46 ||
    prev === 47 ||
    prev === 92
  );
}

function isCamelBoundary(target: string, index: number): boolean {
  if (index === 0) return false;
  const prev = target.charCodeAt(index - 1);
  const curr = target.charCodeAt(index);
  // prev is lowercase a-z, curr is uppercase A-Z
  return prev >= 97 && prev <= 122 && curr >= 65 && curr <= 90;
}

/**
 * Score a target against a query using a greedy left-to-right fuzzy match.
 * Returns null if the query does not fuzzy-match the target.
 * Empty query matches with score 0 and no indices.
 */
export function score(query: string, target: string): FuzzyResult | null {
  if (query.length === 0) {
    return { score: 0, indices: [] };
  }
  if (target.length === 0) {
    return null;
  }

  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Fast path: exact case-insensitive substring match.
  const substringIndex = t.indexOf(q);
  let baseResult: FuzzyResult | null = null;

  if (substringIndex !== -1) {
    const indices: number[] = [];
    for (let i = 0; i < q.length; i += 1) {
      indices.push(substringIndex + i);
    }
    let s = q.length * 16 + 40; // substring bonus
    if (substringIndex === 0) s += 18;
    if (isWordBoundary(target, substringIndex)) s += 8;
    if (isCamelBoundary(target, substringIndex)) s += 6;
    // consecutive bonus for full substring
    s += (q.length - 1) * 4;
    baseResult = { score: s, indices };
  }

  // Greedy fuzzy walk — may beat substring in edge cases, but primarily handles non-contiguous matches.
  const greedy = greedyMatch(q, t, target);
  if (greedy && (!baseResult || greedy.score > baseResult.score)) {
    return greedy;
  }
  return baseResult;
}

function greedyMatch(
  q: string,
  tLower: string,
  tOriginal: string,
): FuzzyResult | null {
  const indices: number[] = [];
  let ti = 0;
  let qi = 0;
  let total = 0;
  let lastMatch = -2;
  let firstMatch = -1;

  while (qi < q.length && ti < tLower.length) {
    if (q.charCodeAt(qi) === tLower.charCodeAt(ti)) {
      indices.push(ti);
      if (firstMatch === -1) firstMatch = ti;

      let bonus = 16;
      if (ti === 0) bonus += 18;
      if (isWordBoundary(tOriginal, ti)) bonus += 8;
      if (isCamelBoundary(tOriginal, ti)) bonus += 6;
      if (lastMatch === ti - 1) bonus += 4;

      total += bonus;
      lastMatch = ti;
      qi += 1;
    }
    ti += 1;
  }

  if (qi < q.length) return null;

  // Penalty for gap between first and last matched index.
  const firstIdx = indices[0] ?? 0;
  const lastIdx = indices[indices.length - 1] ?? firstIdx;
  const span = lastIdx - firstIdx;
  const skipped = span - (q.length - 1);
  total -= skipped;

  return { score: total, indices };
}

/**
 * Convenience: compare two targets for sorting by match quality.
 * Non-matches sort last. Higher score wins. Stable by target length then lexicographic.
 */
export function compareByScore(query: string, a: string, b: string): number {
  const ra = score(query, a);
  const rb = score(query, b);
  if (ra === null && rb === null) return 0;
  if (ra === null) return 1;
  if (rb === null) return -1;
  if (rb.score !== ra.score) return rb.score - ra.score;
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}
