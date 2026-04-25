import { describe, expect, it } from "vitest";
import { LruMap } from "./lru-map";

describe("LruMap", () => {
  it("stores and retrieves values like a Map", () => {
    const cache = new LruMap<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.get("missing")).toBeUndefined();
    expect(cache.size).toBe(2);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("missing")).toBe(false);
  });

  it("evicts the least recently used entry when capacity is exceeded", () => {
    const cache = new LruMap<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4);

    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
    expect(cache.size).toBe(3);
  });

  it("refreshes recency on get so touched entries survive eviction", () => {
    const cache = new LruMap<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.get("a")).toBe(1);

    cache.set("d", 4);

    expect(cache.has("b")).toBe(false);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
  });

  it("treats set on an existing key as a recency refresh", () => {
    const cache = new LruMap<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    cache.set("a", 10);
    cache.set("d", 4);

    expect(cache.has("b")).toBe(false);
    expect(cache.get("a")).toBe(10);
  });

  it("supports delete, clear, and iteration", () => {
    const cache = new LruMap<string, number>(5);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.delete("b")).toBe(true);
    expect(cache.delete("b")).toBe(false);
    expect(cache.has("b")).toBe(false);

    const entries = Array.from(cache);
    expect(entries).toEqual([
      ["a", 1],
      ["c", 3],
    ]);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("rejects non-positive or non-integer capacities", () => {
    expect(() => new LruMap<string, number>(0)).toThrow();
    expect(() => new LruMap<string, number>(-1)).toThrow();
    expect(() => new LruMap<string, number>(1.5)).toThrow();
  });

  it("preserves undefined values without collapsing to absence", () => {
    const cache = new LruMap<string, number | undefined>(3);
    cache.set("a", undefined);
    expect(cache.has("a")).toBe(true);
    expect(cache.get("a")).toBeUndefined();
  });
});
