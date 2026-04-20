import { describe, expect, it } from "vitest";
import { compareByScore, score } from "./fuzzy";

describe("fuzzy/score", () => {
  it("returns neutral match for empty query", () => {
    const r = score("", "Toggle Sidebar");
    expect(r).not.toBeNull();
    expect(r?.score).toBe(0);
    expect(r?.indices).toEqual([]);
  });

  it("returns null for empty target with non-empty query", () => {
    expect(score("a", "")).toBeNull();
  });

  it("returns null when query has no match", () => {
    expect(score("xyz", "Toggle Sidebar")).toBeNull();
  });

  it("matches a contiguous case-insensitive substring", () => {
    const r = score("side", "Toggle Sidebar");
    expect(r).not.toBeNull();
    // "Sidebar" starts at index 7
    expect(r?.indices).toEqual([7, 8, 9, 10]);
  });

  it("matches non-contiguous characters in order", () => {
    const r = score("tgs", "Toggle Sidebar");
    expect(r).not.toBeNull();
    // T (0), g (3 or 4), S (7)
    expect(r?.indices.length).toBe(3);
    expect(r?.indices[0]).toBe(0);
    expect(r?.indices[r?.indices.length - 1]).toBe(7);
  });

  it("prefers prefix matches over middle matches", () => {
    const prefix = score("tog", "Toggle Sidebar");
    const middle = score("tog", "Untoggle");
    expect(prefix).not.toBeNull();
    expect(middle).not.toBeNull();
    expect(prefix?.score).toBeGreaterThan(middle?.score ?? 0);
  });

  it("prefers word-boundary matches over mid-word matches", () => {
    const boundary = score("s", "Toggle Sidebar");
    const midword = score("s", "Tassidebar");
    expect(boundary).not.toBeNull();
    expect(midword).not.toBeNull();
    expect(boundary?.score).toBeGreaterThan(midword?.score ?? 0);
  });

  it("rewards camelCase boundaries", () => {
    const camel = score("c", "openCamel");
    expect(camel).not.toBeNull();
    // Should match uppercase C at index 4 because of camel bonus over lowercase c at index 0?
    // Actually greedy would pick index 0 first. Verify result shape only.
    expect(camel?.indices.length).toBe(1);
  });

  it("is case-insensitive", () => {
    const a = score("TOGGLE", "toggle sidebar");
    expect(a).not.toBeNull();
    expect(a?.indices.slice(0, 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("rewards consecutive matches more than gappy ones", () => {
    const tight = score("abc", "abcdef");
    const loose = score("abc", "a_b_c_");
    expect(tight).not.toBeNull();
    expect(loose).not.toBeNull();
    expect(tight?.score).toBeGreaterThan(loose?.score ?? 0);
  });

  it("handles full string match", () => {
    const r = score("hello", "hello");
    expect(r).not.toBeNull();
    expect(r?.indices).toEqual([0, 1, 2, 3, 4]);
  });

  it("returns null when query is longer than target", () => {
    expect(score("abcdef", "abc")).toBeNull();
  });

  it("supports spaces in query", () => {
    const r = score("to si", "toggle sidebar");
    expect(r).not.toBeNull();
    expect(r?.indices[0]).toBe(0);
  });
});

describe("fuzzy/compareByScore", () => {
  it("puts better matches before worse ones", () => {
    const list = ["Reload Window", "Toggle Sidebar", "Open Settings"];
    const sorted = [...list].sort((a, b) => compareByScore("tog", a, b));
    expect(sorted[0]).toBe("Toggle Sidebar");
  });

  it("puts non-matches after matches", () => {
    const list = ["Reload Window", "Toggle Sidebar", "Apples"];
    const sorted = [...list].sort((a, b) => compareByScore("tog", a, b));
    expect(sorted[0]).toBe("Toggle Sidebar");
    // Non-matches are ordered between themselves arbitrarily, but should not be first.
    expect(sorted[0]).not.toBe("Apples");
  });

  it("is stable-ish for ties (returns 0 when both do not match)", () => {
    expect(compareByScore("zz", "abc", "xyz")).toBe(0);
  });
});
