import { describe, expect, it } from "vitest";

import {
  buildSdkErrorSnapshot,
  buildSdkSessionSnapshot,
  cloneSdkSnapshot,
} from "./pi-sdk-runtime-snapshot.js";

describe("buildSdkSessionSnapshot", () => {
  it("rebuilds the runtime snapshot from the current session", () => {
    expect(
      buildSdkSessionSnapshot(
        {
          sessionId: "sdk-session-1",
          messages: [
            {
              role: "assistant",
              timestamp: 10,
              content: [{ type: "text", text: "Ready" }],
            },
          ],
        },
        "ready",
      ),
    ).toEqual({
      sessionId: "sdk-session-1",
      status: "ready",
      messages: [
        {
          id: "assistant-10",
          role: "assistant",
          text: "Ready",
          status: "complete",
          timestamp: 10,
        },
      ],
      lastError: null,
    });
  });
});

describe("buildSdkErrorSnapshot", () => {
  it("preserves current messages and maps unknown errors to the fallback message", () => {
    expect(
      buildSdkErrorSnapshot(
        {
          sessionId: "sdk-session-1",
          status: "streaming",
          messages: [
            {
              id: "assistant-10",
              role: "assistant",
              text: "Partial",
              status: "complete",
              timestamp: 10,
            },
          ],
          lastError: null,
        },
        "sdk-session-1",
        "boom",
      ),
    ).toEqual({
      sessionId: "sdk-session-1",
      status: "error",
      messages: [
        {
          id: "assistant-10",
          role: "assistant",
          text: "Partial",
          status: "complete",
          timestamp: 10,
        },
      ],
      lastError: "Unknown Pi SDK runtime error",
    });
  });
});

describe("cloneSdkSnapshot", () => {
  it("clones messages and reads context usage from the active session", () => {
    const sourceSnapshot = {
      sessionId: "sdk-session-1",
      status: "ready" as const,
      messages: [
        {
          id: "assistant-10",
          role: "assistant" as const,
          text: "Ready",
          status: "complete" as const,
          timestamp: 10,
        },
      ],
      lastError: null,
    };

    const snapshot = cloneSdkSnapshot(sourceSnapshot, {
      getContextUsage: () => ({
        tokens: 512,
        contextWindow: 8_192,
        percent: 6.25,
      }),
    });

    expect(snapshot).toEqual({
      sessionId: "sdk-session-1",
      status: "ready",
      messages: [
        {
          id: "assistant-10",
          role: "assistant",
          text: "Ready",
          status: "complete",
          timestamp: 10,
        },
      ],
      lastError: null,
      contextUsage: {
        tokens: 512,
        contextWindow: 8_192,
        percent: 6.25,
      },
    });

    expect(snapshot.messages).not.toBe(sourceSnapshot.messages);
  });
});
