import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { SettingsSnapshotSchema } from "./schemas.js";

describe("SettingsSnapshotSchema", () => {
  it("accepts known settings fields with shared model values", () => {
    const decoded = Schema.decodeUnknownSync(SettingsSnapshotSchema)({
      currentProviderId: "anthropic",
      currentModelId: "claude-sonnet-4-5",
      defaultProvider: "google",
      defaultModel: "gemini-2.5-pro",
      thinkingLevel: "high",
      customSetting: { enabled: true },
    });

    expect(decoded).toEqual({
      currentProviderId: "anthropic",
      currentModelId: "claude-sonnet-4-5",
      defaultProvider: "google",
      defaultModel: "gemini-2.5-pro",
      thinkingLevel: "high",
      customSetting: { enabled: true },
    });
  });

  it("rejects invalid known settings fields", () => {
    expect(() =>
      Schema.decodeUnknownSync(SettingsSnapshotSchema)({
        currentProviderId: 42,
        currentModelId: "claude-sonnet-4-5",
        defaultProvider: "google",
        defaultModel: "gemini-2.5-pro",
        thinkingLevel: "extreme",
      }),
    ).toThrow();
  });
});
