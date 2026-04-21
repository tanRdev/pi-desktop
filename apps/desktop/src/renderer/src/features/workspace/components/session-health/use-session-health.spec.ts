// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessionHealth } from "./use-session-health";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSessionHealth", () => {
  it("returns initial state with zero counts", () => {
    const { result } = renderHook(() => useSessionHealth());
    const snap = result.current.snapshot;
    expect(snap.eventCount).toBe(0);
    expect(snap.errorCount).toBe(0);
    expect(snap.errorRate).toBe(0);
    expect(snap.connectionStatus).toBe("connected");
    expect(snap.memory).toBeNull();
  });

  it("increments event count", () => {
    const { result } = renderHook(() => useSessionHealth());
    act(() => {
      result.current.incrementEventCount();
    });
    expect(result.current.snapshot.eventCount).toBe(1);
    act(() => {
      result.current.incrementEventCount();
    });
    expect(result.current.snapshot.eventCount).toBe(2);
  });

  it("increments error count when isError is true", () => {
    const { result } = renderHook(() => useSessionHealth());
    act(() => {
      result.current.incrementEventCount(true);
    });
    expect(result.current.snapshot.eventCount).toBe(1);
    expect(result.current.snapshot.errorCount).toBe(1);
    expect(result.current.snapshot.errorRate).toBe(1);
  });

  it("computes error rate correctly", () => {
    const { result } = renderHook(() => useSessionHealth());
    act(() => {
      result.current.incrementEventCount(false);
      result.current.incrementEventCount(false);
      result.current.incrementEventCount(true);
    });
    expect(result.current.snapshot.eventCount).toBe(3);
    expect(result.current.snapshot.errorCount).toBe(1);
    expect(result.current.snapshot.errorRate).toBeCloseTo(1 / 3);
  });

  it("tracks duration from startTime", () => {
    const fixedNow = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(fixedNow);
    const startMs = fixedNow - 60000;
    const { result } = renderHook(() =>
      useSessionHealth({ startTime: startMs }),
    );
    expect(result.current.snapshot.durationMs).toBe(60000);
  });

  it("uses connectionStatus from options", () => {
    const { result } = renderHook(() =>
      useSessionHealth({ connectionStatus: "offline" }),
    );
    expect(result.current.snapshot.connectionStatus).toBe("offline");
  });

  it("reads performance.memory when available", () => {
    const mockMemory = {
      usedJSHeapSize: 100 * 1024 * 1024,
      totalJSHeapSize: 150 * 1024 * 1024,
      jsHeapSizeLimit: 512 * 1024 * 1024,
    };
    const origPerformance = globalThis.performance;
    Object.defineProperty(globalThis, "performance", {
      value: { memory: mockMemory },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useSessionHealth());
    const mem = result.current.snapshot.memory;
    expect(mem).not.toBeNull();
    if (mem !== null) {
      expect(mem.usedJsHeapMb).toBeCloseTo(100, 1);
      expect(mem.totalJsHeapMb).toBeCloseTo(150, 1);
      expect(mem.jsHeapSizeLimitMb).toBeCloseTo(512, 1);
    }

    Object.defineProperty(globalThis, "performance", {
      value: origPerformance,
      configurable: true,
      writable: true,
    });
  });

  it("returns null memory when performance.memory is unavailable", () => {
    const { result } = renderHook(() => useSessionHealth());
    expect(result.current.snapshot.memory).toBeNull();
  });
});
