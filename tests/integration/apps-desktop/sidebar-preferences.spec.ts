import { describe, expect, it } from "vitest";

import * as sidebarPreferences from "../../../apps/desktop/src/renderer/src/lib/sidebar-preferences";

const { clampLeftSidebarWidth, readLegacyLeftSidebarWidth } =
  sidebarPreferences;

describe("sidebar preference helpers", () => {
  it("does not expose removed load and save wrapper helpers", () => {
    expect("loadLeftSidebarWidth" in sidebarPreferences).toBe(false);
    expect("saveLeftSidebarWidth" in sidebarPreferences).toBe(false);
  });

  it("clamps widths to the allowed range", () => {
    expect(clampLeftSidebarWidth(100)).toBe(140);
    expect(clampLeftSidebarWidth(180)).toBe(180);
    expect(clampLeftSidebarWidth(1000)).toBe(400);
  });

  it("readLegacyLeftSidebarWidth returns null when localStorage value is missing", () => {
    localStorage.removeItem("pidesk.leftSidebarWidth");
    expect(readLegacyLeftSidebarWidth()).toBeNull();
  });

  it("readLegacyLeftSidebarWidth returns null when localStorage value is invalid", () => {
    localStorage.setItem("pidesk.leftSidebarWidth", "not-a-number");
    expect(readLegacyLeftSidebarWidth()).toBeNull();
  });

  it("readLegacyLeftSidebarWidth returns a clamped width for valid legacy values", () => {
    localStorage.setItem("pidesk.leftSidebarWidth", "100");
    expect(readLegacyLeftSidebarWidth()).toBe(140);

    localStorage.setItem("pidesk.leftSidebarWidth", "250");
    expect(readLegacyLeftSidebarWidth()).toBe(250);

    localStorage.setItem("pidesk.leftSidebarWidth", "1000");
    expect(readLegacyLeftSidebarWidth()).toBe(400);
  });
});
