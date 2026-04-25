import { describe, expect, it } from "vitest";

import { mapThinkingLevel } from "./pi-thinking-level.js";

describe("mapThinkingLevel", () => {
  it("maps off to none", () => {
    expect(mapThinkingLevel("off")).toBe("none");
  });

  it("maps minimal and low to low", () => {
    expect(mapThinkingLevel("minimal")).toBe("low");
    expect(mapThinkingLevel("low")).toBe("low");
  });

  it("maps medium to medium", () => {
    expect(mapThinkingLevel("medium")).toBe("medium");
  });

  it("maps high and xhigh to high", () => {
    expect(mapThinkingLevel("high")).toBe("high");
    expect(mapThinkingLevel("xhigh")).toBe("high");
  });

  it("returns undefined for missing level", () => {
    expect(mapThinkingLevel(undefined)).toBeUndefined();
  });
});
