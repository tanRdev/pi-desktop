import { describe, expect, it } from "vitest";

import {
  getContextUsage,
  mapRpcProviders,
  mapRpcSettings,
  toSnapshotMessages,
} from "./pi-cli-rpc-snapshot.js";

describe("toSnapshotMessages", () => {
  it("maps toolResult to tool and drops unknown roles", () => {
    expect(
      toSnapshotMessages([
        {
          role: "toolResult",
          timestamp: 1,
          content: [{ type: "text", text: "done" }],
        },
        {
          role: "branchSummary",
          timestamp: 2,
          content: [{ type: "text", text: "ignore" }],
        },
      ]),
    ).toEqual([
      {
        id: "tool-1",
        role: "tool",
        text: "done",
        status: "complete",
        timestamp: 1,
      },
    ]);
  });
});

describe("getContextUsage", () => {
  it("returns unknown usage after compaction until a newer assistant usage appears", () => {
    expect(
      getContextUsage(
        [
          { role: "compactionSummary", timestamp: 10, summary: "compacted" },
          { role: "user", timestamp: 11, content: "hello" },
        ],
        200_000,
      ),
    ).toEqual({
      tokens: null,
      contextWindow: 200_000,
      percent: null,
    });
  });

  it("adds trailing estimated tokens to the last assistant usage", () => {
    const usage = getContextUsage(
      [
        {
          role: "assistant",
          timestamp: 1,
          content: [{ type: "text", text: "done" }],
          usage: {
            input: 40_000,
            output: 10_000,
            cacheRead: 2_000,
            cacheWrite: 428,
            totalTokens: 52_428,
          },
          stopReason: "stop",
        },
        { role: "user", timestamp: 2, content: "ping" },
      ],
      200_000,
    );

    expect(usage?.tokens).toBe(52_429);
    expect(usage?.contextWindow).toBe(200_000);
    expect(usage?.percent).toBeCloseTo(26.2145, 4);
  });
});

describe("mapRpcSettings", () => {
  it("maps rpc state into public settings", () => {
    expect(
      mapRpcSettings({
        sessionId: "session-1",
        isStreaming: false,
        thinkingLevel: "high",
        model: {
          id: "model-1",
          provider: "google",
        },
      }),
    ).toEqual({
      currentProviderId: "google",
      currentModelId: "model-1",
      defaultProvider: "google",
      defaultModel: "model-1",
      thinkingLevel: "high",
    });
  });
});

describe("mapRpcProviders", () => {
  it("groups models by provider and derives public capabilities", () => {
    expect(
      mapRpcProviders([
        {
          id: "gemini-2.5-flash",
          name: "Gemini 2.5 Flash",
          provider: "google",
          reasoning: true,
          input: ["text", "image"],
          contextWindow: 1_048_576,
          maxTokens: 65_536,
        },
      ]),
    ).toEqual([
      {
        id: "google",
        name: "google",
        isConfigured: true,
        models: [
          {
            id: "gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            providerId: "google",
            supportsThinking: true,
            supportsVision: true,
            contextWindow: 1_048_576,
            maxOutputTokens: 65_536,
          },
        ],
      },
    ]);
  });
});
