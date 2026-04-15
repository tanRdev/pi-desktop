import { describe, expect, it } from "vitest";
import {
  isPromptExecutionVisible,
  shouldPersistThreadConversation,
} from "../../../apps/desktop/src/renderer/src/hooks/use-app-shell-controller";

describe("use-app-shell-controller helpers", () => {
  it("skips persisting empty loading conversations created by session switches", () => {
    expect(
      shouldPersistThreadConversation({
        messages: [],
        status: "starting",
        lastError: null,
      }),
    ).toBe(false);

    expect(
      shouldPersistThreadConversation({
        messages: [
          {
            id: "message-1",
            role: "user",
            content: "hello",
            status: "complete",
            timestamp: 1,
          },
        ],
        status: "starting",
        lastError: null,
      }),
    ).toBe(true);

    expect(
      shouldPersistThreadConversation({
        messages: [],
        status: "streaming",
        lastError: null,
      }),
    ).toBe(true);
  });

  it("only exposes prompt execution when the active thread is actually busy", () => {
    expect(
      isPromptExecutionVisible({
        activeThreadId: "thread-1",
        pendingPromptThreadId: null,
        conversation: {
          messages: [],
          status: "starting",
          lastError: null,
        },
      }),
    ).toBe(false);

    expect(
      isPromptExecutionVisible({
        activeThreadId: "thread-1",
        pendingPromptThreadId: "thread-1",
        conversation: undefined,
      }),
    ).toBe(true);

    expect(
      isPromptExecutionVisible({
        activeThreadId: "thread-1",
        pendingPromptThreadId: null,
        conversation: {
          messages: [],
          status: "streaming",
          lastError: null,
        },
      }),
    ).toBe(true);
  });
});
