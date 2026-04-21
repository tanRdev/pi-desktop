import { describe, expect, it, vi } from "vitest";

import {
  BREAKPOINTS,
  getBreakpointForWidth,
  matchBreakpoint,
} from "./breakpoints";

describe("BREAKPOINTS", () => {
  it("has the correct pixel values for all breakpoints", () => {
    expect(BREAKPOINTS.sm).toBe(640);
    expect(BREAKPOINTS.md).toBe(768);
    expect(BREAKPOINTS.lg).toBe(1024);
    expect(BREAKPOINTS.xl).toBe(1280);
    expect(BREAKPOINTS["2xl"]).toBe(1536);
  });

  it("values are in ascending order", () => {
    const values = Object.values(BREAKPOINTS);
    for (let i = 1; i < values.length; i++) {
      const current: number = values[i]!;
      const prev: number = values[i - 1]!;
      expect(current).toBeGreaterThan(prev);
    }
  });
});

describe("getBreakpointForWidth", () => {
  it("returns 'sm' for widths below 640", () => {
    expect(getBreakpointForWidth(0)).toBe("sm");
    expect(getBreakpointForWidth(639)).toBe("sm");
  });

  it("returns 'md' for widths between 768 and 1023", () => {
    expect(getBreakpointForWidth(768)).toBe("md");
    expect(getBreakpointForWidth(1023)).toBe("md");
  });

  it("returns '2xl' for widths at or above 1536", () => {
    expect(getBreakpointForWidth(1536)).toBe("2xl");
    expect(getBreakpointForWidth(3000)).toBe("2xl");
  });
});

describe("matchBreakpoint", () => {
  it("returns false when window is undefined", () => {
    const original = globalThis.window;
    vi.stubGlobal("window", undefined);
    expect(matchBreakpoint("md")).toBe(false);
    vi.stubGlobal("window", original);
  });

  it("delegates to window.matchMedia with the correct query", () => {
    const mockMatchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", mockMatchMedia);

    matchBreakpoint("lg");

    expect(mockMatchMedia).toHaveBeenCalledWith("(min-width: 1024px)");

    vi.restoreAllMocks();
  });
});
