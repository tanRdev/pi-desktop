// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useZoom } from "./use-zoom";
import { zoomManager } from "./zoom-manager";

afterEach(() => {
  localStorage.clear();
  zoomManager.resetZoom();
  document.documentElement.style.zoom = "";
});

describe("useZoom", () => {
  it("returns default zoom value", () => {
    const { result } = renderHook(() => useZoom());
    expect(result.current.zoom).toBe(1);
  });

  it("setZoom updates the zoom value", () => {
    const { result } = renderHook(() => useZoom());
    act(() => {
      result.current.setZoom(1.5);
    });
    expect(result.current.zoom).toBe(1.5);
  });

  it("zoomIn increments the zoom value", () => {
    const { result } = renderHook(() => useZoom());
    act(() => {
      result.current.zoomIn();
    });
    expect(result.current.zoom).toBeCloseTo(1.1, 5);
  });

  it("resetZoom restores zoom to 1", () => {
    const { result } = renderHook(() => useZoom());
    act(() => {
      result.current.setZoom(2);
    });
    act(() => {
      result.current.resetZoom();
    });
    expect(result.current.zoom).toBe(1);
  });
});
