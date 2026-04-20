import type {
  AgentHostEnvelope,
  AgentHostRequest,
  AgentSnapshot,
  ModelSwitchRequest,
  PiDesktopAgentEvent,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";
import { describe, expect, it, vi } from "vitest";

import {
  type ParentPortLike,
  type WireAgentHostParentPortDependencies,
  wireAgentHostParentPort,
} from "./bridge.js";

type MessageListener = (event: { data: AgentHostRequest }) => void;
type EventListener = (event: PiDesktopAgentEvent) => void;

function createFakeParentPort(): {
  port: ParentPortLike;
  emitRequest: (request: AgentHostRequest) => void;
  posted: AgentHostEnvelope[];
} {
  let listener: MessageListener | null = null;
  const posted: AgentHostEnvelope[] = [];

  const port: ParentPortLike = {
    on(_event, cb) {
      listener = cb;
    },
    postMessage(message) {
      posted.push(message);
    },
  };

  return {
    port,
    emitRequest: (request) => {
      if (!listener) {
        throw new Error("parent port message listener was not wired");
      }
      listener({ data: request });
    },
    posted,
  };
}

function makeRuntime(
  overrides: Partial<WireAgentHostParentPortDependencies["runtime"]> = {},
): WireAgentHostParentPortDependencies["runtime"] & {
  emit: (event: PiDesktopAgentEvent) => void;
} {
  const listeners = new Set<EventListener>();
  const snapshot: AgentSnapshot = {
    sessionId: "s1",
    status: "ready",
    messages: [],
    lastError: null,
  };

  const runtime = {
    bootstrap: vi.fn(async () => {}),
    getProviders: vi.fn(async (): Promise<ProviderSnapshot[]> => []),
    getSettings: vi.fn(async (): Promise<SettingsSnapshot> => ({})),
    getSnapshot: vi.fn((): AgentSnapshot => snapshot),
    switchModel: vi.fn(async (_request: ModelSwitchRequest) => {}),
    prompt: vi.fn(async (_text: string) => {}),
    cancelPrompt: vi.fn(async () => {}),
    reset: vi.fn(async () => {}),
    subscribe: vi.fn((listener: EventListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    ...overrides,
  };

  return {
    ...runtime,
    emit: (event) => {
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

describe("wireAgentHostParentPort", () => {
  it("subscribes to runtime events and forwards them as envelopes", () => {
    const { port, posted } = createFakeParentPort();
    const runtime = makeRuntime();

    wireAgentHostParentPort({ parentPort: port, runtime });

    runtime.emit({ type: "agent_start" });
    runtime.emit({ type: "agent_end" });

    expect(posted).toEqual([
      { type: "event", event: { type: "agent_start" } },
      { type: "event", event: { type: "agent_end" } },
    ]);
  });

  it("returns an unsubscribe that stops forwarding runtime events", () => {
    const { port, posted } = createFakeParentPort();
    const runtime = makeRuntime();

    const unsubscribe = wireAgentHostParentPort({
      parentPort: port,
      runtime,
    });
    unsubscribe();
    runtime.emit({ type: "agent_start" });

    expect(posted).toHaveLength(0);
  });

  it("bootstrap request results in an ack envelope", async () => {
    const { port, emitRequest, posted } = createFakeParentPort();
    const runtime = makeRuntime();

    wireAgentHostParentPort({ parentPort: port, runtime });
    emitRequest({ requestId: "r1", type: "bootstrap" });
    await flushMicrotasks();

    expect(runtime.bootstrap).toHaveBeenCalledOnce();
    expect(posted).toEqual([
      { type: "response", response: { requestId: "r1", kind: "ack" } },
    ]);
  });

  it("getSnapshot responds synchronously with the runtime snapshot", () => {
    const { port, emitRequest, posted } = createFakeParentPort();
    const snapshot: AgentSnapshot = {
      sessionId: "abc",
      status: "streaming",
      messages: [],
      lastError: null,
    };
    const runtime = makeRuntime({ getSnapshot: vi.fn(() => snapshot) });

    wireAgentHostParentPort({ parentPort: port, runtime });
    emitRequest({ requestId: "r2", type: "getSnapshot" });

    expect(posted).toEqual([
      {
        type: "response",
        response: { requestId: "r2", kind: "snapshot", snapshot },
      },
    ]);
  });

  it("getProviders posts a providers envelope", async () => {
    const { port, emitRequest, posted } = createFakeParentPort();
    const providers: ProviderSnapshot[] = [
      { id: "google", name: "Google", models: [] },
    ];
    const runtime = makeRuntime({
      getProviders: vi.fn(async () => providers),
    });

    wireAgentHostParentPort({ parentPort: port, runtime });
    emitRequest({ requestId: "r3", type: "getProviders" });
    await flushMicrotasks();

    expect(posted).toEqual([
      {
        type: "response",
        response: { requestId: "r3", kind: "providers", providers },
      },
    ]);
  });

  it("getSettings posts a settings envelope", async () => {
    const { port, emitRequest, posted } = createFakeParentPort();
    const settings: SettingsSnapshot = { currentProviderId: "google" };
    const runtime = makeRuntime({
      getSettings: vi.fn(async () => settings),
    });

    wireAgentHostParentPort({ parentPort: port, runtime });
    emitRequest({ requestId: "r4", type: "getSettings" });
    await flushMicrotasks();

    expect(posted).toEqual([
      {
        type: "response",
        response: { requestId: "r4", kind: "settings", settings },
      },
    ]);
  });

  it("prompt forwards text and acks", async () => {
    const { port, emitRequest, posted } = createFakeParentPort();
    const runtime = makeRuntime();

    wireAgentHostParentPort({ parentPort: port, runtime });
    emitRequest({ requestId: "r5", type: "prompt", text: "hi" });
    await flushMicrotasks();

    expect(runtime.prompt).toHaveBeenCalledWith("hi");
    expect(posted).toEqual([
      { type: "response", response: { requestId: "r5", kind: "ack" } },
    ]);
  });

  it("switchModel forwards request and acks", async () => {
    const { port, emitRequest, posted } = createFakeParentPort();
    const request: ModelSwitchRequest = {
      providerId: "google",
      modelId: "gemini-2.5-pro",
    };
    const runtime = makeRuntime();

    wireAgentHostParentPort({ parentPort: port, runtime });
    emitRequest({ requestId: "r6", type: "switchModel", request });
    await flushMicrotasks();

    expect(runtime.switchModel).toHaveBeenCalledWith(request);
    expect(posted).toEqual([
      { type: "response", response: { requestId: "r6", kind: "ack" } },
    ]);
  });

  it("cancelPrompt and reset both ack", async () => {
    const { port, emitRequest, posted } = createFakeParentPort();
    const runtime = makeRuntime();

    wireAgentHostParentPort({ parentPort: port, runtime });
    emitRequest({ requestId: "r7", type: "cancelPrompt" });
    emitRequest({ requestId: "r8", type: "reset" });
    await flushMicrotasks();

    expect(runtime.cancelPrompt).toHaveBeenCalledOnce();
    expect(runtime.reset).toHaveBeenCalledOnce();
    expect(posted).toEqual([
      { type: "response", response: { requestId: "r7", kind: "ack" } },
      { type: "response", response: { requestId: "r8", kind: "ack" } },
    ]);
  });

  it("converts Error rejections into error envelopes", async () => {
    const { port, emitRequest, posted } = createFakeParentPort();
    const runtime = makeRuntime({
      bootstrap: vi.fn(async () => {
        throw new Error("boot failed");
      }),
    });

    wireAgentHostParentPort({ parentPort: port, runtime });
    emitRequest({ requestId: "r9", type: "bootstrap" });
    await flushMicrotasks();

    expect(posted).toEqual([
      {
        type: "response",
        response: {
          requestId: "r9",
          kind: "error",
          message: "boot failed",
        },
      },
    ]);
  });

  it("uses a generic message when a non-Error is thrown", async () => {
    const { port, emitRequest, posted } = createFakeParentPort();
    const runtime = makeRuntime({
      prompt: vi.fn(async () => {
        throw "oops";
      }),
    });

    wireAgentHostParentPort({ parentPort: port, runtime });
    emitRequest({ requestId: "r10", type: "prompt", text: "x" });
    await flushMicrotasks();

    expect(posted).toEqual([
      {
        type: "response",
        response: {
          requestId: "r10",
          kind: "error",
          message: "Unknown agent host error",
        },
      },
    ]);
  });
});

async function flushMicrotasks(): Promise<void> {
  // Two rounds cover: resolving the runtime promise and the chained
  // postMessage call inside `.then(...)`.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
