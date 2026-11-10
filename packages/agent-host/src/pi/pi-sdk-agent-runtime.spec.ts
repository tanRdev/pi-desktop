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

  it("shares one in-flight bootstrap across concurrent calls and stays starting until it succeeds", async () => {
    let resolveSession!: (value: { session: unknown }) => void;
    const sessionCreated = new Promise<{ session: unknown }>((resolve) => {
      resolveSession = resolve;
    });
    const session = {
      sessionId: "session-shared",
      messages: [],
      subscribe: vi.fn(() => () => undefined),
    };
    const createAgentSession = vi.fn(() => sessionCreated);

    const runtime = new PiSdkAgentRuntime({
      cwd: "/repo",
      // @ts-expect-error - test double for the SDK session factory
      createAgentSession,
      createModelRegistry: () => ({
        refresh: vi.fn(),
        getAvailable: vi.fn(() => []),
      }),
      createSettingsManager: () => ({
        getGlobalSettings: () => ({}),
        getProjectSettings: () => ({}),
        setDefaultProvider: () => undefined,
        setDefaultModel: () => undefined,
      }),
    });

    const first = runtime.bootstrap();
    const second = runtime.bootstrap();

    expect(createAgentSession).toHaveBeenCalledOnce();
    expect(runtime.getSnapshot().status).toBe("starting");

    resolveSession({ session });
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();

    expect(createAgentSession).toHaveBeenCalledOnce();
    expect(runtime.getSnapshot().status).toBe("ready");
    expect(runtime.getSnapshot().sessionId).toBe("session-shared");

    // A later bootstrap is a no-op once the session exists.
    await runtime.bootstrap();
    expect(createAgentSession).toHaveBeenCalledOnce();
  });

  it("propagates bootstrap failure to all waiters and allows a retry", async () => {
    const session = {
      sessionId: "session-retry",
      messages: [],
      subscribe: vi.fn(() => () => undefined),
    };
    const createAgentSession = vi
      .fn()
      .mockRejectedValueOnce(new Error("session create failed"))
      .mockResolvedValue({ session });

    const runtime = new PiSdkAgentRuntime({
      cwd: "/repo",
      createAgentSession,
      createModelRegistry: () => ({
        refresh: vi.fn(),
        getAvailable: vi.fn(() => []),
      }),
      createSettingsManager: () => ({
        getGlobalSettings: () => ({}),
        getProjectSettings: () => ({}),
        setDefaultProvider: () => undefined,
        setDefaultModel: () => undefined,
      }),
    });

    await expect(runtime.bootstrap()).rejects.toThrow("session create failed");
    expect(runtime.getSnapshot().status).toBe("error");

    await expect(runtime.bootstrap()).resolves.toBeUndefined();
    expect(runtime.getSnapshot().status).toBe("ready");
    expect(createAgentSession).toHaveBeenCalledTimes(2);
  });
});
