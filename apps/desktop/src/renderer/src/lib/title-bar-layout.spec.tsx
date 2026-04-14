import { describe, expect, it } from "vitest";
import { getTrafficLightInset } from "./title-bar-layout";

describe("getTrafficLightInset", () => {
  it("uses the macOS inset for darwin", () => {
    expect(getTrafficLightInset("darwin")).toBe(16);
  });

  it("falls back to the default inset for other platforms", () => {
    expect(getTrafficLightInset("linux")).toBe(12);
    expect(getTrafficLightInset(null)).toBe(12);
  });
});
