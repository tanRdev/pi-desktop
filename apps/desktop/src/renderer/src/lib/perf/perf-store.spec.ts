import { describe, expect, it, vi } from "vitest";
import { createPerfStore, PERF_BUFFER_CAPACITY } from "./perf-store";

function makeEntry(name: string, ms: number, ts: number = 0) {
  return { name, ms, ts };
}

describe("perf-store", () => {
  it("starts empty with the requested capacity", () => {
    const store = createPerfStore(50);
    expect(store.snapshot()).toEqual([]);
    expect(store.capacity).toBe(50);
  });

  it("defaults to PERF_BUFFER_CAPACITY entries", () => {
    const store = createPerfStore();
    expect(store.capacity).toBe(PERF_BUFFER_CAPACITY);
  });

  it("rejects non-positive capacity", () => {
    expect(() => createPerfStore(0)).toThrow();
    expect(() => createPerfStore(-1)).toThrow();
  });

  it("appends entries in insertion order", () => {
    const store = createPerfStore(10);
    store.push(makeEntry("a", 1));
    store.push(makeEntry("b", 2));
    expect(store.snapshot().map((e) => e.name)).toEqual(["a", "b"]);
  });

  it("evicts oldest entries past capacity (ring buffer)", () => {
    const store = createPerfStore(3);
    store.push(makeEntry("a", 1));
    store.push(makeEntry("b", 2));
    store.push(makeEntry("c", 3));
    store.push(makeEntry("d", 4));
    expect(store.snapshot().map((e) => e.name)).toEqual(["b", "c", "d"]);
  });

  it("snapshot returns a stable copy decoupled from the buffer", () => {
    const store = createPerfStore(3);
    store.push(makeEntry("a", 1));
    const snap = store.snapshot();
    store.push(makeEntry("b", 2));
    expect(snap.map((e) => e.name)).toEqual(["a"]);
  });

  it("notifies subscribers on push and clear", () => {
    const store = createPerfStore(3);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.push(makeEntry("a", 1));
    store.push(makeEntry("b", 2));
    expect(listener).toHaveBeenCalledTimes(2);

    store.clear();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(store.snapshot()).toEqual([]);

    unsubscribe();
    store.push(makeEntry("c", 3));
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("multiple subscribers all receive notifications", () => {
    const store = createPerfStore(3);
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    store.push(makeEntry("x", 1));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
