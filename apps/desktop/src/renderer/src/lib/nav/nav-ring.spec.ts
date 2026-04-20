import { describe, expect, it } from "vitest";
import { createNavRing } from "./nav-ring";

describe("createNavRing", () => {
  it("initializes with first region as current", () => {
    const ring = createNavRing(["sidebar", "editor", "terminal"]);
    expect(ring.currentRegion).toBe("sidebar");
  });

  it("exposes regions list", () => {
    const ring = createNavRing(["sidebar", "editor", "terminal"]);
    expect(ring.regions).toEqual(["sidebar", "editor", "terminal"]);
  });

  it("cycles to next region and wraps around", () => {
    const ring = createNavRing(["sidebar", "editor", "terminal"]);
    expect(ring.focusNext()).toBe("editor");
    expect(ring.currentRegion).toBe("editor");
    expect(ring.focusNext()).toBe("terminal");
    expect(ring.currentRegion).toBe("terminal");
    expect(ring.focusNext()).toBe("sidebar");
    expect(ring.currentRegion).toBe("sidebar");
  });

  it("cycles to previous region and wraps around", () => {
    const ring = createNavRing(["sidebar", "editor", "terminal"]);
    expect(ring.focusPrevious()).toBe("terminal");
    expect(ring.currentRegion).toBe("terminal");
    expect(ring.focusPrevious()).toBe("editor");
    expect(ring.currentRegion).toBe("editor");
    expect(ring.focusPrevious()).toBe("sidebar");
    expect(ring.currentRegion).toBe("sidebar");
  });

  it("focusRegion sets current to the specified region", () => {
    const ring = createNavRing(["sidebar", "editor", "terminal"]);
    expect(ring.focusRegion("terminal")).toBe("terminal");
    expect(ring.currentRegion).toBe("terminal");
  });

  it("focusRegion throws for unknown region", () => {
    const ring = createNavRing(["sidebar", "editor", "terminal"]);
    expect(() => ring.focusRegion("unknown")).toThrow(
      "Unknown region: unknown",
    );
  });

  it("throws when created with empty regions", () => {
    expect(() => createNavRing([])).toThrow(
      "createNavRing requires at least one region",
    );
  });

  it("continues cycling from focusRegion position", () => {
    const ring = createNavRing(["sidebar", "editor", "terminal"]);
    ring.focusRegion("terminal");
    expect(ring.focusNext()).toBe("sidebar");
    expect(ring.focusPrevious()).toBe("terminal");
  });

  it("regions list is frozen", () => {
    const ring = createNavRing(["sidebar", "editor", "terminal"]);
    expect(Object.isFrozen(ring.regions)).toBe(true);
  });
});
