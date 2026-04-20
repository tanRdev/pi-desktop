// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PerfEntry } from "./perf-store";
import { createPerfStore } from "./perf-store";
import { usePerf, usePerfEntries } from "./use-perf";

describe("usePerf", () => {
  it("pushes a recorded entry into the store on stop", () => {
    const store = createPerfStore(10);
    const { result } = renderHook(() => usePerf(store));

    const captured: PerfEntry[] = [];
    act(() => {
      const handle = result.current.start("op.alpha");
      captured.push(handle.stop());
    });

    const entry = captured[0];
    if (entry === undefined) throw new Error("stop did not return entry");
    expect(entry.name).toBe("op.alpha");
    expect(entry.ms).toBeGreaterThanOrEqual(0);
    expect(entry.ts).toBeGreaterThan(0);

    const snap = store.snapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]?.name).toBe("op.alpha");
  });

  it("supports multiple sequential timers without interference", () => {
    const store = createPerfStore(10);
    const { result } = renderHook(() => usePerf(store));

    act(() => {
      result.current.start("a").stop();
      result.current.start("b").stop();
      result.current.start("c").stop();
    });

    expect(store.snapshot().map((e) => e.name)).toEqual(["a", "b", "c"]);
  });

  it("start identity is stable across re-renders for the same store", () => {
    const store = createPerfStore(10);
    const { result, rerender } = renderHook(() => usePerf(store));
    const first = result.current.start;
    rerender();
    expect(result.current.start).toBe(first);
  });
});

describe("usePerfEntries", () => {
  it("returns the current snapshot and re-renders on push", () => {
    const store = createPerfStore(10);
    const { result } = renderHook(() => usePerfEntries(store));
    expect(result.current).toEqual([]);

    act(() => {
      store.push({ name: "x", ms: 1, ts: 1 });
    });
    expect(result.current.map((e) => e.name)).toEqual(["x"]);

    act(() => {
      store.push({ name: "y", ms: 2, ts: 2 });
    });
    expect(result.current.map((e) => e.name)).toEqual(["x", "y"]);
  });

  it("unsubscribes on unmount", () => {
    const store = createPerfStore(10);
    const { unmount } = renderHook(() => usePerfEntries(store));
    unmount();
    // Pushing after unmount must not throw.
    expect(() => store.push({ name: "z", ms: 1, ts: 1 })).not.toThrow();
  });
});
