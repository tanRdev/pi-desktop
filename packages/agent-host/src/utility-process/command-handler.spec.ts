import type {
  AgentHostRequest,
  AgentSnapshot,
  ModelSwitchRequest,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";
import { describe, expect, it, vi } from "vitest";

import {
  type CommandHandlerRuntime,
  createAgentHostCommandHandler,
} from "./command-handler.js";

function baseSnapshot(): AgentSnapshot {
  return {
    sessionId: "s1",
    status: "ready",
    messages: [],
    lastError: null,
  };
}

function makeRuntime(
  overrides: Partial<CommandHandlerRuntime> = {},
): CommandHandlerRuntime {
  return {
    bootstrap: vi.fn(async () => {}),
    getProviders: vi.fn(async (): Promise<ProviderSnapshot[]> => []),
    getSettings: vi.fn(async (): Promise<SettingsSnapshot> => ({})),
    getSnapshot: vi.fn((): AgentSnapshot => baseSnapshot()),
    switchModel: vi.fn(async (_request: ModelSwitchRequest) => {}),
    prompt: vi.fn(async (_text: string) => {}),
    cancelPrompt: vi.fn(async () => {}),
    reset: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("createAgentHostCommandHandler", () => {
  it("bootstrap returns ack and invokes runtime.bootstrap", async () => {
    const runtime = makeRuntime();
    const handle = createAgentHostCommandHandler(runtime);

    const envelope = await handle({ requestId: "r1", type: "bootstrap" });

    expect(runtime.bootstrap).toHaveBeenCalledOnce();
    expect(envelope).toEqual({
      type: "response",
      response: { requestId: "r1", kind: "ack" },
    });
  });

  it("getSnapshot returns the runtime snapshot", async () => {
    const snapshot: AgentSnapshot = {
      sessionId: "abc",
      status: "streaming",
      messages: [],
      lastError: null,
    };
    const runtime = makeRuntime({ getSnapshot: vi.fn(() => snapshot) });
    const handle = createAgentHostCommandHandler(runtime);

    const envelope = await handle({ requestId: "r2", type: "getSnapshot" });

    expect(envelope).toEqual({
      type: "response",
      response: { requestId: "r2", kind: "snapshot", snapshot },
    });
  });

  it("getProviders returns resolved providers", async () => {
    const providers: ProviderSnapshot[] = [
      { id: "google", name: "Google", models: [] },
    ];
    const runtime = makeRuntime({
      getProviders: vi.fn(async () => providers),
    });
    const handle = createAgentHostCommandHandler(runtime);

    const envelope = await handle({ requestId: "r3", type: "getProviders" });

    expect(envelope).toEqual({
      type: "response",
      response: { requestId: "r3", kind: "providers", providers },
    });
  });

  it("getSettings returns resolved settings", async () => {
    const settings: SettingsSnapshot = { currentModelId: "m1" };
    const runtime = makeRuntime({ getSettings: vi.fn(async () => settings) });
    const handle = createAgentHostCommandHandler(runtime);

    const envelope = await handle({ requestId: "r4", type: "getSettings" });

    expect(envelope).toEqual({
      type: "response",
      response: { requestId: "r4", kind: "settings", settings },
    });
  });

  it("prompt forwards text and returns ack", async () => {
    const runtime = makeRuntime();
    const handle = createAgentHostCommandHandler(runtime);

    const envelope = await handle({
      requestId: "r5",
      type: "prompt",
      text: "hello",
    });

    expect(runtime.prompt).toHaveBeenCalledWith("hello");
    expect(envelope).toEqual({
      type: "response",
      response: { requestId: "r5", kind: "ack" },
    });
  });

  it("switchModel forwards model request and returns ack", async () => {
    const runtime = makeRuntime();
    const handle = createAgentHostCommandHandler(runtime);
    const request: ModelSwitchRequest = {
      providerId: "google",
      modelId: "gemini-2.5-pro",
    };

    const envelope = await handle({
      requestId: "r6",
      type: "switchModel",
      request,
    });

    expect(runtime.switchModel).toHaveBeenCalledWith(request);
    expect(envelope).toEqual({
      type: "response",
      response: { requestId: "r6", kind: "ack" },
    });
  });

  it("cancelPrompt acks after calling runtime.cancelPrompt", async () => {
    const runtime = makeRuntime();
    const handle = createAgentHostCommandHandler(runtime);

    const envelope = await handle({ requestId: "r7", type: "cancelPrompt" });

    expect(runtime.cancelPrompt).toHaveBeenCalledOnce();
    expect(envelope).toEqual({
      type: "response",
      response: { requestId: "r7", kind: "ack" },
    });
  });

  it("reset acks after calling runtime.reset", async () => {
    const runtime = makeRuntime();
    const handle = createAgentHostCommandHandler(runtime);

    const envelope = await handle({ requestId: "r8", type: "reset" });

    expect(runtime.reset).toHaveBeenCalledOnce();
    expect(envelope).toEqual({
      type: "response",
      response: { requestId: "r8", kind: "ack" },
    });
  });

  it("returns an error envelope when a runtime method throws an Error", async () => {
    const runtime = makeRuntime({
      prompt: vi.fn(async () => {
        throw new Error("model offline");
      }),
    });
    const handle = createAgentHostCommandHandler(runtime);

    const envelope = await handle({
      requestId: "r9",
      type: "prompt",
      text: "hi",
    });

    expect(envelope).toEqual({
      type: "response",
      response: {
        requestId: "r9",
        kind: "error",
        message: "model offline",
      },
    });
  });

  it("returns a generic error message when a runtime method rejects with a non-Error", async () => {
    const runtime = makeRuntime({
      bootstrap: vi.fn(async () => {
        throw "string failure";
      }),
    });
    const handle = createAgentHostCommandHandler(runtime);

    const envelope = await handle({ requestId: "r10", type: "bootstrap" });

    expect(envelope).toEqual({
      type: "response",
      response: {
        requestId: "r10",
        kind: "error",
        message: "Unknown agent host error",
      },
    });
  });

  it("returns an error envelope for malformed requests with unknown type", async () => {
    const runtime = makeRuntime();
    const handle = createAgentHostCommandHandler(runtime);

    // Simulate a malformed request that would pass transport serialization
    // but not match the AgentHostRequest union. Using @ts-expect-error to
    // avoid `as` casts per repo convention.
    // @ts-expect-error - intentionally malformed request type
    const envelope = await handle({ requestId: "r11", type: "bogus" });

    expect(envelope).toEqual({
      type: "response",
      response: {
        requestId: "r11",
        kind: "error",
        message: "Unknown request type: bogus",
      },
    });
  });

  it("malformed request with missing fields still produces a structured error envelope", async () => {
    const runtime = makeRuntime();
    const handle = createAgentHostCommandHandler(runtime);

    // @ts-expect-error - both fields are intentionally wrong shapes
    const envelope = await handle({ requestId: 42, type: undefined });

    expect(envelope.type).toBe("response");
    if (envelope.type === "response" && envelope.response.kind === "error") {
      expect(envelope.response.requestId).toBe("");
      expect(envelope.response.message).toBe("Unknown request type: <unknown>");
    } else {
      throw new Error("expected error envelope");
    }
  });

  it("does not invoke unrelated runtime methods for a given command", async () => {
    const runtime = makeRuntime();
    const handle = createAgentHostCommandHandler(runtime);

    const request: AgentHostRequest = { requestId: "r12", type: "bootstrap" };
    await handle(request);

    expect(runtime.bootstrap).toHaveBeenCalledOnce();
    expect(runtime.prompt).not.toHaveBeenCalled();
    expect(runtime.getProviders).not.toHaveBeenCalled();
    expect(runtime.reset).not.toHaveBeenCalled();
  });
});
