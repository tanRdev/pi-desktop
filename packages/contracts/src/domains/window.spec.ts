import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { windowContracts } from "./window.js";

describe("windowContracts", () => {
  it("declares getFullscreenState invoke and fullscreenChanged event channels", () => {
    expect(windowContracts.getFullscreenState.channel).toBe(
      "window:getFullscreenState",
    );
    expect(windowContracts.fullscreenChanged.kind).toBe("event");
    expect(windowContracts.fullscreenChanged.channel).toBe(
      "window:fullscreenChanged",
    );
  });

  it("accepts boolean fullscreen payloads", () => {
    expect(
      Schema.decodeUnknownSync(windowContracts.getFullscreenState.response)(
        true,
      ),
    ).toBe(true);
    expect(
      Schema.decodeUnknownSync(windowContracts.fullscreenChanged.payload)(
        false,
      ),
    ).toBe(false);
  });

  it("rejects non-boolean fullscreen payloads", () => {
    expect(() =>
      Schema.decodeUnknownSync(windowContracts.fullscreenChanged.payload)(
        "true",
      ),
    ).toThrow();
  });
});
