import { describe, expect, it } from "vitest";

import {
  createExitError,
  parseRpcMessagesResponse,
  parseRpcState,
} from "./pi-cli-rpc-protocol.js";

describe("parseRpcState", () => {
  it("throws when sessionId is missing", () => {
    expect(() => parseRpcState({})).toThrow(
      "Pi RPC returned invalid session state",
    );
  });

  it("keeps only valid model fields and filters non-string inputs", () => {
    expect(
      parseRpcState({
        sessionId: "session-1",
        isStreaming: true,
        thinkingLevel: "medium",
        model: {
          id: "model-1",
          name: "Model 1",
          provider: "google",
          reasoning: true,
          input: ["text", 1, "image"],
          contextWindow: 1000,
          maxTokens: 200,
        },
      }),
    ).toEqual({
      sessionId: "session-1",
      isStreaming: true,
      thinkingLevel: "medium",
      model: {
        id: "model-1",
        name: "Model 1",
        provider: "google",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 1000,
        maxTokens: 200,
      },
    });
  });
});

describe("parseRpcMessagesResponse", () => {
  it("drops invalid messages", () => {
    expect(
      parseRpcMessagesResponse({
        messages: [
          { role: "assistant", timestamp: 1, content: "ok" },
          { role: 123, timestamp: 2 },
          null,
        ],
      }),
    ).toEqual([{ role: "assistant", timestamp: 1, content: "ok" }]);
  });
});

describe("createExitError", () => {
  it("formats process exit details", () => {
    expect(createExitError(9, null).message).toBe(
      "Pi CLI RPC process exited (9)",
    );
  });
});
