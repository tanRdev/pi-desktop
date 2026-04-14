import { describe, expect, it } from "vitest";

import { MockAgentRuntime } from "../../../packages/agent-host/src/mock/mock-agent-runtime";
import type { PiDesktopAgentEvent } from "../../../packages/shared/src";

describe("MockAgentRuntime", () => {
  it("boots into a ready state with a stable mock session", async () => {
    const runtime = new MockAgentRuntime();

    await runtime.bootstrap();

    expect(runtime.getSnapshot()).toMatchObject({
      sessionId: "mock-session",
      status: "ready",
      lastError: null,
    });
  });

  it("streams assistant updates after a prompt", async () => {
    const runtime = new MockAgentRuntime();
    const events: PiDesktopAgentEvent[] = [];

    runtime.subscribe((event) => {
      events.push(event);
    });

    await runtime.bootstrap();
    await runtime.prompt("hello from the shell test");

    expect(events.some((event) => event.type === "agent_start")).toBe(true);
    expect(events.some((event) => event.type === "turn_start")).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "tool_execution_start" &&
          event.toolName === "workspace.inspect",
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "message_update" &&
          event.role === "assistant" &&
          event.text.includes("hello from the shell test"),
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "tool_execution_end" &&
          event.toolName === "reply.compose" &&
          event.isError === false,
      ),
    ).toBe(true);
    expect(events.some((event) => event.type === "agent_end")).toBe(true);

    const snapshot = runtime.getSnapshot();
    const lastMessage = snapshot.messages[snapshot.messages.length - 1];

    expect(snapshot.status).toBe("ready");
    expect(lastMessage).toMatchObject({
      role: "assistant",
      status: "complete",
    });
    expect(lastMessage?.text).toContain("Pi Desktop mock assistant received");
  });
});
