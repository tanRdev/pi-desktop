import { describe, expect, it, vi } from "vitest";

import { refreshCliRpcSnapshot } from "./pi-cli-rpc-snapshot-refresh.js";

describe("refreshCliRpcSnapshot", () => {
  it("fetches state and messages together and builds the public snapshot", async () => {
    const sendCommand = vi.fn(async (command: { type: string }) => {
      if (command.type === "get_state") {
        return {
          sessionId: "session-1",
          isStreaming: true,
          model: {
            id: "gemini-2.5-pro",
            provider: "google",
            contextWindow: 200_000,
          },
        };
      }

      if (command.type === "get_messages") {
        return {
          messages: [
            {
              role: "assistant",
              timestamp: 1,
              content: [{ type: "text", text: "hello" }],
              usage: {
                input: 10,
                output: 5,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 15,
              },
              stopReason: "stop",
            },
          ],
        };
      }

      throw new Error(`Unexpected command: ${command.type}`);
    });

    await expect(refreshCliRpcSnapshot({ sendCommand })).resolves.toEqual({
      rpcState: {
        sessionId: "session-1",
        isStreaming: true,
        model: {
          id: "gemini-2.5-pro",
          provider: "google",
          contextWindow: 200_000,
        },
      },
      snapshot: {
        sessionId: "session-1",
        status: "streaming",
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            text: "hello",
            status: "complete",
            timestamp: 1,
          },
        ],
        lastError: null,
        currentProviderId: "google",
        currentModelId: "gemini-2.5-pro",
        contextUsage: {
          tokens: 15,
          contextWindow: 200_000,
          percent: 0.0075,
        },
      },
    });

    expect(sendCommand).toHaveBeenNthCalledWith(1, { type: "get_state" });
    expect(sendCommand).toHaveBeenNthCalledWith(2, { type: "get_messages" });
  });
});
