import { describe, expect, it } from "vitest";

import { mapSdkProviders } from "./pi-sdk-provider-snapshot.js";

describe("mapSdkProviders", () => {
  it("groups models by provider and preserves discovery order", () => {
    const result = mapSdkProviders([
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        provider: "google",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 1_048_576,
      },
      {
        id: "claude-sonnet-4-5-20251101",
        name: "Claude Sonnet 4.5",
        provider: "anthropic",
        reasoning: true,
        input: ["text"],
        contextWindow: 200_000,
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        provider: "google",
        reasoning: false,
        input: ["text"],
        contextWindow: 1_048_576,
      },
    ]);

    expect(result).toEqual([
      {
        id: "google",
        name: "google",
        isConfigured: true,
        models: [
          {
            id: "gemini-2.5-pro",
            name: "Gemini 2.5 Pro",
            providerId: "google",
            supportsThinking: true,
            supportsVision: true,
            contextWindow: 1_048_576,
          },
          {
            id: "gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            providerId: "google",
            supportsThinking: false,
            supportsVision: false,
            contextWindow: 1_048_576,
          },
        ],
      },
      {
        id: "anthropic",
        name: "anthropic",
        isConfigured: true,
        models: [
          {
            id: "claude-sonnet-4-5-20251101",
            name: "Claude Sonnet 4.5",
            providerId: "anthropic",
            supportsThinking: true,
            supportsVision: false,
            contextWindow: 200_000,
          },
        ],
      },
    ]);
  });

  it("falls back to the model id when a display name is missing", () => {
    const result = mapSdkProviders([
      {
        id: "gemini-2.5-flash",
        provider: "google",
      },
    ]);

    expect(result).toEqual([
      {
        id: "google",
        name: "google",
        isConfigured: true,
        models: [
          {
            id: "gemini-2.5-flash",
            name: "gemini-2.5-flash",
            providerId: "google",
            supportsThinking: undefined,
            supportsVision: false,
            contextWindow: undefined,
          },
        ],
      },
    ]);
  });

  it("returns an empty list when no models are available", () => {
    expect(mapSdkProviders([])).toEqual([]);
  });
});
