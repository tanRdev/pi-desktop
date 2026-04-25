import { describe, expect, it, vi } from "vitest";

import {
  getSdkProviders,
  getSdkSettings,
  switchSdkModel,
} from "./pi-sdk-runtime-settings.js";

describe("pi-sdk-runtime-settings", () => {
  it("refreshes the registry before mapping providers", () => {
    const refresh = vi.fn();
    const getAvailable = vi.fn(() => [
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
        input: ["text"],
      },
    ]);

    expect(
      getSdkProviders({
        refresh,
        getAvailable,
      }),
    ).toEqual([
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
            supportsThinking: undefined,
            supportsVision: false,
            contextWindow: undefined,
          },
        ],
      },
    ]);

    expect(refresh).toHaveBeenCalledOnce();
    expect(getAvailable).toHaveBeenCalledOnce();
  });

  it("returns empty providers when the registry is unavailable", () => {
    expect(getSdkProviders(null)).toEqual([]);
  });

  it("prefers project settings over global settings", () => {
    expect(
      getSdkSettings({
        getGlobalSettings: () => ({
          defaultProvider: "anthropic",
          defaultModel: "claude-sonnet-4-5-20251101",
          defaultThinkingLevel: "xhigh",
        }),
        getProjectSettings: () => ({
          defaultProvider: "google",
          defaultModel: "gemini-2.5-pro",
          defaultThinkingLevel: "minimal",
        }),
        setDefaultProvider: () => undefined,
        setDefaultModel: () => undefined,
      }),
    ).toEqual({
      currentProviderId: "google",
      currentModelId: "gemini-2.5-pro",
      defaultProvider: "anthropic",
      defaultModel: "claude-sonnet-4-5-20251101",
      thinkingLevel: "low",
    });
  });

  it("returns an empty settings snapshot when the manager is unavailable", () => {
    expect(getSdkSettings(null)).toEqual({});
  });

  it("persists the selected provider and model", () => {
    const setDefaultProvider = vi.fn();
    const setDefaultModel = vi.fn();

    expect(
      switchSdkModel(
        {
          getGlobalSettings: () => ({}),
          getProjectSettings: () => ({}),
          setDefaultProvider,
          setDefaultModel,
        },
        {
          providerId: "google",
          modelId: "gemini-2.5-pro",
        },
      ),
    ).toEqual({
      type: "model_changed",
      providerId: "google",
      modelId: "gemini-2.5-pro",
    });

    expect(setDefaultProvider).toHaveBeenCalledWith("google");
    expect(setDefaultModel).toHaveBeenCalledWith("gemini-2.5-pro");
  });

  it("throws when model switching is attempted without settings access", () => {
    expect(() =>
      switchSdkModel(null, {
        providerId: "google",
        modelId: "gemini-2.5-pro",
      }),
    ).toThrowError("Settings manager not initialized");
  });
});
