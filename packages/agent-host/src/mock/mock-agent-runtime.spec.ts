import type { PiDesktopAgentEvent } from "@pi-desktop/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MockAgentRuntime } from "./mock-agent-runtime.js";

describe("MockAgentRuntime", () => {
  let runtime: MockAgentRuntime;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    runtime = new MockAgentRuntime();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in a 'starting' state with no messages", () => {
    const snapshot = runtime.getSnapshot();
    expect(snapshot.status).toBe("starting");
    expect(snapshot.messages).toEqual([]);
    expect(snapshot.sessionId).toBe("mock-session");
    expect(snapshot.currentProviderId).toBe("google");
    expect(snapshot.currentModelId).toBe("gemini-2.5-pro");
  });

  it("bootstrap transitions snapshot to ready", async () => {
    await runtime.bootstrap();

    const snapshot = runtime.getSnapshot();
    expect(snapshot.status).toBe("ready");
    expect(snapshot.lastError).toBeNull();
  });

  it("getProviders exposes google + anthropic with expected models", async () => {
    const providers = await runtime.getProviders();

    expect(providers.map((p) => p.id)).toEqual(["google", "anthropic"]);
    const google = providers.find((p) => p.id === "google");
    expect(google?.models.map((m) => m.id)).toEqual([
      "gemini-2.5-pro",
      "gemini-2.5-flash",
    ]);
    const anthropic = providers.find((p) => p.id === "anthropic");
    expect(anthropic?.models.every((m) => m.providerId === "anthropic")).toBe(
      true,
    );
  });

  it("getSettings reflects the current selection from the snapshot", async () => {
    const settings = await runtime.getSettings();
    expect(settings.currentProviderId).toBe("google");
    expect(settings.currentModelId).toBe("gemini-2.5-pro");
    expect(settings.defaultProvider).toBe("google");
    expect(settings.defaultModel).toBe("gemini-2.5-pro");
  });

  it("switchModel updates snapshot and emits a model_changed event", async () => {
    const events: PiDesktopAgentEvent[] = [];
    runtime.subscribe((event) => events.push(event));

    await runtime.switchModel({
      providerId: "anthropic",
      modelId: "claude-sonnet-4-5-20251101",
    });

    expect(runtime.getSnapshot().currentProviderId).toBe("anthropic");
    expect(runtime.getSnapshot().currentModelId).toBe(
      "claude-sonnet-4-5-20251101",
    );
    expect(events).toEqual([
      {
        type: "model_changed",
        providerId: "anthropic",
        modelId: "claude-sonnet-4-5-20251101",
      },
    ]);
  });

  it("subscribe returns an unsubscribe that stops delivery", async () => {
    const events: PiDesktopAgentEvent[] = [];
    const unsubscribe = runtime.subscribe((event) => events.push(event));

    await runtime.switchModel({
      providerId: "google",
      modelId: "gemini-2.5-flash",
    });
    unsubscribe();
    await runtime.switchModel({
      providerId: "google",
      modelId: "gemini-2.5-pro",
    });

    expect(events).toHaveLength(1);
  });

  it("getSnapshot returns a defensive copy of messages", async () => {
    await runtime.bootstrap();
    const first = runtime.getSnapshot();
    first.messages.push({
      id: "injected",
      role: "user",
      text: "x",
      status: "complete",
      timestamp: 0,
    });

    expect(runtime.getSnapshot().messages).toEqual([]);
  });

  it("prompt emits the expected end-to-end event sequence", async () => {
    await runtime.bootstrap();

    const events: PiDesktopAgentEvent[] = [];
    runtime.subscribe((event) => events.push(event));

    await runtime.prompt("hello there");

    const types = events.map((event) => event.type);
    expect(types).toEqual([
      "agent_start",
      "turn_start",
      "tool_execution_start",
      "tool_execution_update",
      "tool_execution_end",
      "message_start",
      "message_update",
      "tool_execution_start",
      "tool_execution_update",
      "message_end",
      "tool_execution_end",
      "turn_end",
      "agent_end",
    ]);

    const snapshot = runtime.getSnapshot();
    expect(snapshot.status).toBe("ready");
    expect(snapshot.messages).toHaveLength(2);
    expect(snapshot.messages[0]).toMatchObject({
      role: "user",
      text: "hello there",
      status: "complete",
    });
    expect(snapshot.messages[1]).toMatchObject({
      role: "assistant",
      status: "complete",
    });
    expect(snapshot.messages[1]?.text).toContain("hello there");
  });

  it("prompt bootstraps automatically when called from 'starting' state", async () => {
    const events: PiDesktopAgentEvent[] = [];
    runtime.subscribe((event) => events.push(event));

    await runtime.prompt("boot-on-demand");

    const snapshot = runtime.getSnapshot();
    expect(snapshot.messages).toHaveLength(2);
    expect(snapshot.status).toBe("ready");
    expect(events[0]).toEqual({ type: "agent_start" });
  });

  it("cancelPrompt before prompt is a no-op and does not throw", async () => {
    await expect(runtime.cancelPrompt()).resolves.toBeUndefined();
  });

  it("reset emits agent_end + agent_start and clears messages", async () => {
    await runtime.bootstrap();
    await runtime.prompt("hi");

    const events: PiDesktopAgentEvent[] = [];
    runtime.subscribe((event) => events.push(event));

    const beforeId = runtime.getSnapshot().sessionId;
    vi.setSystemTime(new Date("2024-06-01T00:00:00Z"));
    await runtime.reset();

    expect(events).toEqual([{ type: "agent_end" }, { type: "agent_start" }]);
    const snapshot = runtime.getSnapshot();
    expect(snapshot.messages).toEqual([]);
    expect(snapshot.status).toBe("ready");
    expect(snapshot.sessionId).not.toBe(beforeId);
    expect(snapshot.sessionId.startsWith("mock-session-")).toBe(true);
  });

  it("multiple subscribers each receive events", async () => {
    const a: PiDesktopAgentEvent[] = [];
    const b: PiDesktopAgentEvent[] = [];
    runtime.subscribe((event) => a.push(event));
    runtime.subscribe((event) => b.push(event));

    await runtime.switchModel({
      providerId: "google",
      modelId: "gemini-2.5-flash",
    });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0]).toEqual(b[0]);
  });
});
