import { describe, expect, it } from "vitest";

import { createInitialAgentLiveFeed } from "../../../packages/shell-model/src";
import {
  applyLiveToolEvent,
  completeCurrentTurn,
} from "../../../packages/shell-model/src/agent-feed-live-state";

describe("agent-feed live state helpers", () => {
  it("keeps a tool bound to the same turn across out-of-order updates", () => {
    const initial = createInitialAgentLiveFeed();

    const updated = applyLiveToolEvent(
      initial,
      {
        type: "tool_execution_update",
        toolCallId: "tool-1",
        toolName: "workspace.inspect",
        args: { prompt: "Summarize the workspace" },
        partialResult: { status: "reading" },
      },
      120,
    );
    const completed = applyLiveToolEvent(
      updated.feed,
      {
        type: "tool_execution_end",
        toolCallId: "tool-1",
        toolName: "workspace.inspect",
        result: { status: "ok" },
        isError: false,
      },
      125,
    );

    expect(updated.turnId).toBe("turn-1");
    expect(completed.feed.toolsById["tool-1"]).toMatchObject({
      toolCallId: "tool-1",
      turnId: "turn-1",
      toolName: "workspace.inspect",
      status: "complete",
      partialResult: { status: "reading" },
      result: { status: "ok" },
      startedAt: 120,
      endedAt: 125,
      isError: false,
    });
  });

  it("marks the current turn as errored when a tool fails", () => {
    const initial = createInitialAgentLiveFeed();

    const started = applyLiveToolEvent(
      initial,
      {
        type: "tool_execution_start",
        toolCallId: "tool-2",
        toolName: "reply.compose",
        args: { prompt: "Ship the redesign" },
      },
      130,
    );
    const failed = applyLiveToolEvent(
      started.feed,
      {
        type: "tool_execution_end",
        toolCallId: "tool-2",
        toolName: "reply.compose",
        result: { error: "Provider rejected request" },
        isError: true,
      },
      135,
    );
    const completed = completeCurrentTurn(failed.feed, 140);

    expect(completed.turnId).toBe("turn-1");
    expect(completed.feed.currentTurnId).toBeNull();
    expect(completed.feed.turns).toEqual([
      {
        id: "turn-1",
        status: "error",
        startedAt: 130,
        endedAt: 140,
        messageIds: [],
        toolCallIds: ["tool-2"],
      },
    ]);
  });
});
