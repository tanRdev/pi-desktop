// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLayoutState } from "./use-layout-state";

const STORAGE_PREFIX = "pi-desktop:layout:";

let mockBreakpointCurrent = "sm";

vi.mock("./use-breakpoint", () => ({
  useBreakpoint: () => ({
    width: 500,
    height: 600,
    current: mockBreakpointCurrent,
    isSm: mockBreakpointCurrent === "sm",
    isMd: mockBreakpointCurrent === "md",
    isLg: mockBreakpointCurrent === "lg",
    isXl: mockBreakpointCurrent === "xl" || mockBreakpointCurrent === "2xl",
  }),
}));

beforeEach(() => {
  localStorage.clear();
  mockBreakpointCurrent = "sm";
});

describe("useLayoutState", () => {
  it("initializes with sidebarCollapsed false by default", () => {
    const { result } = renderHook(() => useLayoutState());
    expect(result.current.sidebarCollapsed).toBe(false);
  });

  it("toggleSidebar flips sidebarCollapsed and persists", () => {
    const { result } = renderHook(() => useLayoutState());

    act(() => {
      result.current.toggleSidebar();
    });

    expect(result.current.sidebarCollapsed).toBe(true);
    const raw = localStorage.getItem(`${STORAGE_PREFIX}sm`);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.sidebarCollapsed).toBe(true);
  });

  it("setPanelSize updates panelSizes and persists", () => {
    const { result } = renderHook(() => useLayoutState());

    act(() => {
      result.current.setPanelSize("left", 260);
    });

    expect(result.current.panelSizes.left).toBe(260);
    const raw = localStorage.getItem(`${STORAGE_PREFIX}sm`);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.panelSizes.left).toBe(260);
  });

  it("loads persisted state for the current breakpoint on mount", () => {
    localStorage.setItem(
      `${STORAGE_PREFIX}sm`,
      JSON.stringify({ sidebarCollapsed: true, panelSizes: { right: 300 } }),
    );

    const { result } = renderHook(() => useLayoutState());

    expect(result.current.sidebarCollapsed).toBe(true);
    expect(result.current.panelSizes.right).toBe(300);
  });

  it("stores state per breakpoint independently", () => {
    localStorage.setItem(
      `${STORAGE_PREFIX}sm`,
      JSON.stringify({ sidebarCollapsed: true, panelSizes: {} }),
    );
    localStorage.setItem(
      `${STORAGE_PREFIX}lg`,
      JSON.stringify({ sidebarCollapsed: false, panelSizes: { left: 400 } }),
    );

    const { result } = renderHook(() => useLayoutState());
    expect(result.current.sidebarCollapsed).toBe(true);

    act(() => {
      result.current.toggleSidebar();
    });

    expect(result.current.sidebarCollapsed).toBe(false);

    const smRaw = localStorage.getItem(`${STORAGE_PREFIX}sm`);
    const smParsed = JSON.parse(smRaw!);
    expect(smParsed.sidebarCollapsed).toBe(false);

    const lgRaw = localStorage.getItem(`${STORAGE_PREFIX}lg`);
    const lgParsed = JSON.parse(lgRaw!);
    expect(lgParsed.sidebarCollapsed).toBe(false);
    expect(lgParsed.panelSizes.left).toBe(400);
  });

  it("falls back to defaults when localStorage has corrupt data", () => {
    localStorage.setItem(`${STORAGE_PREFIX}sm`, "not-json");

    const { result } = renderHook(() => useLayoutState());

    expect(result.current.sidebarCollapsed).toBe(false);
  });
});
