import { describe, expect, it } from "vitest";
import { clampLeftSidebarWidth } from "./sidebar-preferences";

describe("clampLeftSidebarWidth", () => {
  it("preserves 0 so the sidebar can stay collapsed", () => {
    expect(clampLeftSidebarWidth(0)).toBe(0);
  });
});
