import type { AgentMessageSnapshot } from "@pi-desktop/shared";

/**
 * A single message participating in a thread search. Each entry carries
 * enough context (thread id + title) to navigate back to the source after
 * a search hit.
 */
export interface SearchableMessage {
  threadId: string;
  threadTitle: string;
  /** Optional — used to bias scoring toward more recent threads. */
  threadLastActivityAt?: number | null;
  message: AgentMessageSnapshot;
}

export interface HighlightRange {
  /** Inclusive start index inside the snippet string. */
  start: number;
  /** Exclusive end index inside the snippet string. */
  end: number;
}

export interface SearchResult {
  threadId: string;
  threadTitle: string;
  messageId: string;
  /** The role of the matched message — useful for icon hints in the UI. */
  role: AgentMessageSnapshot["role"];
  /** Match timestamp (ms epoch) for display. */
  timestamp: number;
  /** Pre-computed snippet around the first match in the message text. */
  snippet: string;
  /** Indices inside `snippet` to render as highlighted. */
  highlights: HighlightRange[];
  /** Higher score = better match. Used to rank results. */
  score: number;
}

export interface SearchOptions {
  /** Maximum number of results to return. Defaults to 50. */
  limit?: number;
  /**
   * Snippet half-window. The snippet is taken as
   * `[matchIndex - snippetRadius, matchIndex + queryLength + snippetRadius]`.
   * Defaults to 40.
   */
  snippetRadius?: number;
  /**
   * Skip messages whose role is one of these. Defaults to `["tool"]`
   * so transcript noise from tools doesn't dominate results.
   */
  excludeRoles?: ReadonlyArray<AgentMessageSnapshot["role"]>;
}

const DEFAULT_LIMIT = 50;
const DEFAULT_SNIPPET_RADIUS = 40;
const DEFAULT_EXCLUDED_ROLES: ReadonlyArray<AgentMessageSnapshot["role"]> = [
  "tool",
];

/**
 * Find every (case-insensitive) occurrence of `query` inside `text`, returning
 * absolute indices into `text`. Returns an empty array when `query` is empty.
 */
export function findMatches(text: string, query: string): number[] {
  if (!query) return [];
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const matches: number[] = [];
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    matches.push(idx);
    from = idx + needle.length;
  }
  return matches;
}

/**
 * Build a snippet around the matches, with highlight ranges projected into
 * the snippet's coordinate space. Ellipses are added when the snippet is a
 * proper substring of `text`.
 */
export function buildSnippet(
  text: string,
  matches: number[],
  query: string,
  snippetRadius: number,
): { snippet: string; highlights: HighlightRange[] } {
  if (matches.length === 0 || !query) {
    const trimmed =
      text.length > snippetRadius * 2
        ? `${text.slice(0, snippetRadius * 2)}…`
        : text;
    return { snippet: trimmed, highlights: [] };
  }

  const first = matches[0] ?? 0;
  const queryLen = query.length;

  const rawStart = Math.max(0, first - snippetRadius);
  const rawEnd = Math.min(text.length, first + queryLen + snippetRadius);

  const prefix = rawStart > 0 ? "…" : "";
  const suffix = rawEnd < text.length ? "…" : "";
  const slice = text.slice(rawStart, rawEnd);
  const snippet = `${prefix}${slice}${suffix}`;

  const offset = prefix.length - rawStart;
  const highlights: HighlightRange[] = [];
  for (const m of matches) {
    if (m < rawStart || m >= rawEnd) continue;
    const start = m + offset;
    const end = Math.min(snippet.length - suffix.length, start + queryLen);
    if (end > start) highlights.push({ start, end });
  }
  return { snippet, highlights };
}

/**
 * Compute a score for a single message hit. The score blends:
 *   - match count (more matches = better)
 *   - role bias (user/assistant > system)
 *   - recency (newer messages and threads rise)
 *   - position bonus (a match at the very start of the text scores higher)
 */
function scoreEntry(
  entry: SearchableMessage,
  matches: number[],
  query: string,
  now: number,
): number {
  let score = matches.length * 10;

  switch (entry.message.role) {
    case "user":
      score += 6;
      break;
    case "assistant":
      score += 4;
      break;
    case "system":
      score += 1;
      break;
    default:
      break;
  }

  // Position bonus — earlier matches feel more relevant.
  const first = matches[0] ?? -1;
  if (first === 0) score += 4;
  else if (first > 0 && first < 32) score += 2;

  // Whole-word-ish bonus: if the match is bounded by non-word chars.
  const text = entry.message.text;
  if (first >= 0) {
    const before = first === 0 ? "" : text.charAt(first - 1);
    const after = text.charAt(first + query.length);
    if (!/\w/.test(before) && !/\w/.test(after)) score += 3;
  }

  // Recency bias on the message timestamp.
  const ageMs = Math.max(0, now - entry.message.timestamp);
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 1) score += 5;
  else if (ageDays < 7) score += 3;
  else if (ageDays < 30) score += 1;

  // Recency bias on the thread itself (helps when message timestamps
  // are missing or coarse).
  if (entry.threadLastActivityAt) {
    const threadAgeDays =
      Math.max(0, now - entry.threadLastActivityAt) / (1000 * 60 * 60 * 24);
    if (threadAgeDays < 1) score += 2;
    else if (threadAgeDays < 7) score += 1;
  }

  return score;
}

/**
 * Run a substring search across `messages`. Returns ranked results, capped
 * at `options.limit`. Pure function — safe to call from any context.
 *
 * Empty queries return an empty result list.
 */
export function search(
  query: string,
  messages: ReadonlyArray<SearchableMessage>,
  options: SearchOptions = {},
): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const limit = options.limit ?? DEFAULT_LIMIT;
  const snippetRadius = options.snippetRadius ?? DEFAULT_SNIPPET_RADIUS;
  const excludeRoles = options.excludeRoles ?? DEFAULT_EXCLUDED_ROLES;
  const now = Date.now();

  const results: SearchResult[] = [];
  for (const entry of messages) {
    if (excludeRoles.includes(entry.message.role)) continue;
    const text = entry.message.text;
    if (!text) continue;
    const matches = findMatches(text, trimmed);
    if (matches.length === 0) continue;

    const { snippet, highlights } = buildSnippet(
      text,
      matches,
      trimmed,
      snippetRadius,
    );
    results.push({
      threadId: entry.threadId,
      threadTitle: entry.threadTitle,
      messageId: entry.message.id,
      role: entry.message.role,
      timestamp: entry.message.timestamp,
      snippet,
      highlights,
      score: scoreEntry(entry, matches, trimmed, now),
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.timestamp - a.timestamp;
  });

  return results.slice(0, limit);
}
