import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";
import {
  buildSnippet,
  findMatches,
  type SearchableMessage,
  search,
} from "./search-engine";

function msg(
  id: string,
  text: string,
  overrides: Partial<AgentMessageSnapshot> = {},
): AgentMessageSnapshot {
  return {
    id,
    role: "user",
    text,
    status: "complete",
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

function entry(
  threadId: string,
  threadTitle: string,
  message: AgentMessageSnapshot,
  threadLastActivityAt: number | null = null,
): SearchableMessage {
  return { threadId, threadTitle, message, threadLastActivityAt };
}

describe("findMatches", () => {
  it("returns an empty array for an empty query", () => {
    expect(findMatches("hello world", "")).toEqual([]);
  });

  it("finds all case-insensitive occurrences", () => {
    expect(findMatches("Hello hello HELLO", "hello")).toEqual([0, 6, 12]);
  });

  it("returns an empty array when there is no match", () => {
    expect(findMatches("foo bar baz", "qux")).toEqual([]);
  });

  it("does not overlap matches", () => {
    // "aaaa" with query "aa" -> 0, 2 (not 0,1,2)
    expect(findMatches("aaaa", "aa")).toEqual([0, 2]);
  });

  it("finds a match at the very end", () => {
    const text = "the quick brown fox";
    expect(findMatches(text, "fox")).toEqual([text.length - 3]);
  });
});

describe("buildSnippet", () => {
  it("returns the original text (truncated) with no matches", () => {
    const out = buildSnippet("hello world", [], "", 40);
    expect(out.snippet).toBe("hello world");
    expect(out.highlights).toEqual([]);
  });

  it("adds ellipses when the snippet trims the source", () => {
    const text = `${"a".repeat(100)}needle${"b".repeat(100)}`;
    const matches = findMatches(text, "needle");
    const out = buildSnippet(text, matches, "needle", 10);
    expect(out.snippet.startsWith("…")).toBe(true);
    expect(out.snippet.endsWith("…")).toBe(true);
    expect(out.snippet).toContain("needle");
    expect(out.highlights).toHaveLength(1);
    const h = out.highlights[0];
    expect(h).toBeDefined();
    if (!h) return;
    expect(out.snippet.slice(h.start, h.end)).toBe("needle");
  });

  it("omits prefix ellipsis when match is at start", () => {
    const text = "needle in a haystack";
    const matches = findMatches(text, "needle");
    const out = buildSnippet(text, matches, "needle", 50);
    expect(out.snippet.startsWith("…")).toBe(false);
    expect(out.snippet).toBe("needle in a haystack");
    expect(out.highlights[0]).toEqual({ start: 0, end: 6 });
  });

  it("projects multiple highlights into snippet coordinates", () => {
    const text = "foo bar foo baz foo";
    const matches = findMatches(text, "foo");
    const out = buildSnippet(text, matches, "foo", 100);
    expect(out.highlights).toHaveLength(3);
    for (const h of out.highlights) {
      expect(out.snippet.slice(h.start, h.end).toLowerCase()).toBe("foo");
    }
  });
});

describe("search", () => {
  it("returns no results for an empty or whitespace query", () => {
    const messages = [entry("t1", "T1", msg("m1", "hello world"))];
    expect(search("", messages)).toEqual([]);
    expect(search("   ", messages)).toEqual([]);
  });

  it("matches across threads and returns the matched message", () => {
    const messages = [
      entry("t1", "Thread One", msg("m1", "no match here")),
      entry("t2", "Thread Two", msg("m2", "this contains needle nicely")),
    ];
    const results = search("needle", messages);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      threadId: "t2",
      messageId: "m2",
      role: "user",
    });
    expect(results[0]?.snippet).toContain("needle");
  });

  it("excludes tool messages by default", () => {
    const messages = [
      entry("t1", "T1", msg("m1", "needle in a tool", { role: "tool" })),
      entry(
        "t1",
        "T1",
        msg("m2", "needle in a user message", { role: "user" }),
      ),
    ];
    const results = search("needle", messages);
    expect(results.map((r) => r.messageId)).toEqual(["m2"]);
  });

  it("respects excludeRoles option override", () => {
    const messages = [
      entry("t1", "T1", msg("m1", "needle one", { role: "tool" })),
      entry("t1", "T1", msg("m2", "needle two", { role: "user" })),
    ];
    const results = search("needle", messages, { excludeRoles: [] });
    expect(results).toHaveLength(2);
  });

  it("ranks user matches above assistant when scores otherwise tie", () => {
    const messages = [
      entry(
        "t1",
        "T1",
        msg("m-asst", "needle in assistant", { role: "assistant" }),
      ),
      entry("t2", "T2", msg("m-user", "needle in user", { role: "user" })),
    ];
    const results = search("needle", messages);
    expect(results[0]?.messageId).toBe("m-user");
  });

  it("ranks more matches higher", () => {
    const messages = [
      entry("t1", "T1", msg("m1", "needle")),
      entry("t2", "T2", msg("m2", "needle needle needle")),
    ];
    const results = search("needle", messages);
    expect(results[0]?.messageId).toBe("m2");
  });

  it("falls back to timestamp on score tie", () => {
    const base = 1_700_000_000_000;
    const messages = [
      entry("t1", "T1", msg("m1", "alpha needle", { timestamp: base })),
      entry("t2", "T2", msg("m2", "alpha needle", { timestamp: base + 5_000 })),
    ];
    const results = search("needle", messages);
    expect(results.map((r) => r.messageId)).toEqual(["m2", "m1"]);
  });

  it("respects the limit option", () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      entry(`t${i}`, `T${i}`, msg(`m${i}`, `needle ${i}`)),
    );
    const results = search("needle", messages, { limit: 3 });
    expect(results).toHaveLength(3);
  });

  it("is case-insensitive", () => {
    const messages = [entry("t1", "T1", msg("m1", "Hello WORLD"))];
    const results = search("hello", messages);
    expect(results).toHaveLength(1);
    expect(results[0]?.messageId).toBe("m1");
  });

  it("skips messages with empty text", () => {
    const messages = [
      entry("t1", "T1", msg("m1", "")),
      entry("t1", "T1", msg("m2", "needle here")),
    ];
    const results = search("needle", messages);
    expect(results.map((r) => r.messageId)).toEqual(["m2"]);
  });

  it("trims the query before searching", () => {
    const messages = [entry("t1", "T1", msg("m1", "needle here"))];
    const results = search("   needle   ", messages);
    expect(results).toHaveLength(1);
  });

  it("includes highlight indices that map back to the snippet", () => {
    const messages = [
      entry("t1", "T1", msg("m1", "alpha beta gamma needle delta")),
    ];
    const [result] = search("needle", messages);
    expect(result).toBeDefined();
    if (!result) return;
    expect(result.highlights).toHaveLength(1);
    const h = result.highlights[0];
    expect(h).toBeDefined();
    if (!h) return;
    expect(result.snippet.slice(h.start, h.end).toLowerCase()).toBe("needle");
  });

  it("biases recency for more recent messages", () => {
    const now = Date.now();
    const old = now - 1000 * 60 * 60 * 24 * 60; // 60 days
    const recent = now - 1000 * 60 * 60; // 1 hour
    const messages = [
      entry("t1", "Old", msg("m-old", "needle", { timestamp: old })),
      entry("t2", "Recent", msg("m-recent", "needle", { timestamp: recent })),
    ];
    const results = search("needle", messages);
    expect(results[0]?.messageId).toBe("m-recent");
  });
});
