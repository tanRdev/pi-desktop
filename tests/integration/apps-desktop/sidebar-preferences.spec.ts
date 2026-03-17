import { describe, expect, it } from "vitest";

import {
  clampLeftSidebarWidth,
  loadLeftSidebarWidth,
  saveLeftSidebarWidth,
} from "../../../apps/desktop/src/renderer/src/lib/sidebar-preferences";

describe("sidebar preference helpers", () => {
  it("clamps widths to the allowed range", () => {
    expect(clampLeftSidebarWidth(100)).toBe(140);
    expect(clampLeftSidebarWidth(180)).toBe(180);
    expect(clampLeftSidebarWidth(1000)).toBe(400);
  });

  it("loadLeftSidebarWidth returns default when localStorage missing or invalid", () => {
    // Clear any existing value
    localStorage.removeItem("pidesk.leftSidebarWidth");
    expect(loadLeftSidebarWidth()).toBe(180);

    localStorage.setItem("pidesk.leftSidebarWidth", "250");
    expect(loadLeftSidebarWidth()).toBe(250);

    localStorage.setItem("pidesk.leftSidebarWidth", "not-a-number");
    expect(loadLeftSidebarWidth()).toBe(180);
  });

  it("saveLeftSidebarWidth writes clamped value to localStorage", () => {
    saveLeftSidebarWidth(100);
    expect(localStorage.getItem("pidesk.leftSidebarWidth")).toBe("140");

    saveLeftSidebarWidth(350);
    expect(localStorage.getItem("pidesk.leftSidebarWidth")).toBe("350");
  });
});
