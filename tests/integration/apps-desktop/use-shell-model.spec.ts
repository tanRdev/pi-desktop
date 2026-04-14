import { describe, expect, it } from "vitest";
import {
  parseModelSelectionValue,
  resolveCurrentModelValue,
} from "../../../apps/desktop/src/renderer/src/hooks/use-shell-model";

describe("use-shell-model helpers", () => {
  it("parses provider and model IDs from selector values", () => {
    expect(
      parseModelSelectionValue("anthropic::claude-sonnet-4-20250514"),
    ).toEqual({
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
    });
    expect(parseModelSelectionValue("")).toBeNull();
    expect(parseModelSelectionValue("anthropic")).toBeNull();
    expect(parseModelSelectionValue("anthropic::")).toBeNull();
  });

  it("prefers the current runtime model and falls back by model identity", () => {
    const providers = [
      {
        id: "google",
        name: "Google",
        isConfigured: true,
        models: [
          {
            id: "gemini-2.5-pro",
            name: "Gemini 2.5 Pro",
            providerId: "google",
          },
        ],
      },
      {
        id: "anthropic",
        name: "Anthropic",
        isConfigured: true,
        models: [
          {
            id: "claude-sonnet-4-20250514",
            name: "Claude Sonnet 4",
            providerId: "anthropic",
          },
        ],
      },
    ];

    expect(
      resolveCurrentModelValue(providers, {
        currentProviderId: "anthropic",
        currentModelId: "claude-sonnet-4-20250514",
        defaultProvider: "google",
        defaultModel: "gemini-2.5-pro",
      }),
    ).toBe("anthropic::claude-sonnet-4-20250514");

    expect(
      resolveCurrentModelValue(providers, {
        currentProviderId: undefined,
        currentModelId: "claude-sonnet-4-20250514",
        defaultProvider: "google",
        defaultModel: "gemini-2.5-pro",
      }),
    ).toBe("anthropic::claude-sonnet-4-20250514");
  });
});
