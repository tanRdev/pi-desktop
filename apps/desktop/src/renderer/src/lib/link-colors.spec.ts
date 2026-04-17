import { describe, expect, it } from "vitest";

import { getLinkColorForId, getLinkColorHex } from "./link-colors";

describe("getLinkColorForId", () => {
  it("returns a valid link color for any id", () => {
    const color = getLinkColorForId("abc123");
    expect(["blue", "green", "orange", "pink", "purple", "yellow"]).toContain(
      color,
    );
  });

  it("is deterministic for the same id", () => {
    expect(getLinkColorForId("repo-42")).toBe(getLinkColorForId("repo-42"));
  });

  it("distributes across different ids", () => {
    const colors = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"].map(
        getLinkColorForId,
      ),
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  it("falls back to blue for empty string", () => {
    expect(getLinkColorForId("")).toBe("blue");
  });
});

describe("getLinkColorHex", () => {
  it("returns the expected hex for each color", () => {
    expect(getLinkColorHex("blue")).toBe("#7FB3D9");
    expect(getLinkColorHex("green")).toBe("#5FB87A");
    expect(getLinkColorHex("orange")).toBe("#D9955F");
    expect(getLinkColorHex("pink")).toBe("#D97FA8");
    expect(getLinkColorHex("purple")).toBe("#A88FD9");
    expect(getLinkColorHex("yellow")).toBe("#D9C57F");
  });
});
