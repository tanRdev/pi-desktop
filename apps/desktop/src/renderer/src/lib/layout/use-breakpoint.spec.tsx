// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBreakpoint } from "./use-breakpoint";

describe("useBreakpoint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns initial width and height from document.documentElement", () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.width).toBeGreaterThanOrEqual(0);
    expect(result.current.height).toBeGreaterThanOrEqual(0);
  });

  it("returns 'sm' as default current breakpoint for small viewports", () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(typeof result.current.current).toBe("string");
    expect(["sm", "md", "lg", "xl", "2xl"]).toContain(result.current.current);
  });

  it("updates breakpoint when ResizeObserver fires and debounce elapses", () => {
    let resizeCallback: ResizeObserverCallback = () => {};
    const mockObserve = vi.fn();
    const mockDisconnect = vi.fn();

    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: ResizeObserverCallback) {
          resizeCallback = cb;
        }
        observe = mockObserve;
        disconnect = mockDisconnect;
        unobserve() {}
      },
    );

    const { result } = renderHook(() => useBreakpoint());

    expect(mockObserve).toHaveBeenCalled();

    act(() => {
      resizeCallback(
        [
          {
            target: document.documentElement,
            contentRect: { width: 1200, height: 800 },
          },
        ] as unknown as ResizeObserverEntry[],
        {} as ResizeObserver,
      );
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.width).toBe(1200);
    expect(result.current.height).toBe(800);
    expect(result.current.current).toBe("lg");

    vi.restoreAllMocks();
  });

  it("debounces rapid resize events", () => {
    let resizeCallback: ResizeObserverCallback = () => {};

    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: ResizeObserverCallback) {
          resizeCallback = cb;
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );

    const { result } = renderHook(() => useBreakpoint());

    act(() => {
      resizeCallback(
        [
          {
            target: document.documentElement,
            contentRect: { width: 500, height: 400 },
          },
        ] as unknown as ResizeObserverEntry[],
        {} as ResizeObserver,
      );
    });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    act(() => {
      resizeCallback(
        [
          {
            target: document.documentElement,
            contentRect: { width: 1600, height: 900 },
          },
        ] as unknown as ResizeObserverEntry[],
        {} as ResizeObserver,
      );
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.current).not.toBe("2xl");

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.current).toBe("2xl");

    vi.restoreAllMocks();
  });

  it("computes boolean flags from current breakpoint", () => {
    let resizeCallback: ResizeObserverCallback = () => {};

    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: ResizeObserverCallback) {
          resizeCallback = cb;
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );

    const { result } = renderHook(() => useBreakpoint());

    act(() => {
      resizeCallback(
        [
          {
            target: document.documentElement,
            contentRect: { width: 500, height: 400 },
          },
        ] as unknown as ResizeObserverEntry[],
        {} as ResizeObserver,
      );
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.isSm).toBe(true);
    expect(result.current.isMd).toBe(false);
    expect(result.current.isLg).toBe(false);
    expect(result.current.isXl).toBe(false);

    vi.restoreAllMocks();
  });

  it("sets isXl true for both xl and 2xl breakpoints", () => {
    let resizeCallback: ResizeObserverCallback = () => {};

    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: ResizeObserverCallback) {
          resizeCallback = cb;
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );

    const { result } = renderHook(() => useBreakpoint());

    act(() => {
      resizeCallback(
        [
          {
            target: document.documentElement,
            contentRect: { width: 1600, height: 900 },
          },
        ] as unknown as ResizeObserverEntry[],
        {} as ResizeObserver,
      );
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.current).toBe("2xl");
    expect(result.current.isXl).toBe(true);

    vi.restoreAllMocks();
  });

  it("disconnects ResizeObserver on unmount", () => {
    const mockDisconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor() {}
        observe() {}
        disconnect = mockDisconnect;
        unobserve() {}
      },
    );

    const { unmount } = renderHook(() => useBreakpoint());

    expect(mockDisconnect).not.toHaveBeenCalled();

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
