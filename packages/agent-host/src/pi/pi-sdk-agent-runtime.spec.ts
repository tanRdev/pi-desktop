import { describe, expect, it, vi } from "vitest";

import { PiSdkAgentRuntime } from "./pi-sdk-agent-runtime.js";

describe("PiSdkAgentRuntime", () => {
  it("getProviders refreshes the registry and returns grouped provider snapshots", async () => {
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
        id: "gemini-2.5-flash",
        provider: "google",
      },
      {
        id: "claude-sonnet-4-5-20251101",
        name: "Claude Sonnet 4.5",
        provider: "anthropic",
        input: ["text"],
      },
    ]);

    const runtime = new PiSdkAgentRuntime({
      cwd: "/repo",
      createModelRegistry: () => ({
        refresh,
        getAvailable,
      }),
      createSettingsManager: () => ({
        getGlobalSettings: () => ({}),
        getProjectSettings: () => ({}),
        setDefaultProvider: () => undefined,
        setDefaultModel: () => undefined,
      }),
    });

    await expect(runtime.getProviders()).resolves.toEqual([
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
            name: "gemini-2.5-flash",
            providerId: "google",
            supportsThinking: undefined,
            supportsVision: false,
            contextWindow: undefined,
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
});
