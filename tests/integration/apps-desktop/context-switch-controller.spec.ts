import { describe, expect, it, vi } from "vitest";
import {
  type ContextSwitchState,
  createContextSwitchController,
  createFailedAgentHost,
  createLoadingAgentHost,
} from "../../../apps/desktop/src/main/context-switch-controller";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function createContext(id: string, worktreePath: string) {
  return {
    repositoryId: `/tmp/${id}`,
    worktreePath,
    thread: {
      id: `thread-${id}`,
    },
    socketPath: `/tmp/${id}.sock`,
    runtimeId: null,
    command: ["node", "server.js"],
    agentMode: "mock" as const,
    agentDirectory: `/tmp/${id}/.pi`,
  };
}

function createTransport() {
  const closeSpy = vi.fn();

  return {
    close() {
      closeSpy();
    },
    closeSpy,
  };
}

function createHost(name: string) {
  return {
    getProviders: vi.fn(async () => []),
    getSettings: vi.fn(async () => ({})),
    getSnapshot: vi.fn(async () => ({
      sessionId: name,
      status: "ready" as const,
      messages: [],
      lastError: null,
    })),
    prompt: vi.fn(async () => undefined),
    cancelPrompt: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
    subscribe: vi.fn(() => () => undefined),
  };
}

function createState(): ContextSwitchState<
  ReturnType<typeof createHost>,
  ReturnType<typeof createTransport>
> {
  return {
    context: createContext("initial", "/tmp/initial"),
    host: createHost("initial-host"),
    transport: createTransport(),
    unsubscribe: vi.fn(),
  };
}

describe("context-switch-controller", () => {
  it("switches into a loading host before the awaited attachment completes", async () => {
    const state = createState();
    const previousUnsubscribe = state.unsubscribe;
    const nextContext = createContext("beta", "/tmp/beta");
    const attachedHost = createHost("beta-host");
    const attachedTransport = createTransport();
    const notifySessionChanged = vi.fn();
    const subscribeToHost = vi.fn(() => vi.fn());
    const pendingAttachment = createDeferred<{
      context: typeof nextContext;
      host: typeof attachedHost;
      transport: typeof attachedTransport;
    }>();

    const controller = createContextSwitchController(state, {
      attachContext: vi.fn(() => pendingAttachment.promise),
      subscribeToHost,
      notifySessionChanged,
    });

    const switchPromise = controller.switchContext(async () => nextContext);

    await Promise.resolve();

    expect(state.context).toEqual(nextContext);
    await expect(state.host.getSnapshot()).resolves.toEqual({
      sessionId: nextContext.thread.id,
      status: "starting",
      messages: [],
      lastError: null,
    });
    expect(previousUnsubscribe).toHaveBeenCalledTimes(1);
    expect(state.transport?.closeSpy).not.toHaveBeenCalled();
    expect(notifySessionChanged).toHaveBeenCalledTimes(1);

    pendingAttachment.resolve({
      context: nextContext,
      host: attachedHost,
      transport: attachedTransport,
    });
    await switchPromise;

    expect(state.host).toBe(attachedHost);
    expect(state.transport).toBe(attachedTransport);
    expect(subscribeToHost).toHaveBeenCalledWith(
      attachedHost,
      nextContext.thread,
    );
    expect(notifySessionChanged).toHaveBeenCalledTimes(2);
  });

  it("drops stale attachment results when a newer switch starts", async () => {
    const state = createState();
    const firstContext = createContext("alpha", "/tmp/alpha");
    const secondContext = createContext("beta", "/tmp/beta");
    const firstAttachedTransport = createTransport();
    const secondAttachedTransport = createTransport();
    const firstAttachment = createDeferred<{
      context: typeof firstContext;
      host: ReturnType<typeof createHost>;
      transport: typeof firstAttachedTransport;
    }>();
    const secondAttachment = createDeferred<{
      context: typeof secondContext;
      host: ReturnType<typeof createHost>;
      transport: typeof secondAttachedTransport;
    }>();

    const controller = createContextSwitchController(state, {
      attachContext: vi
        .fn<
          (context: typeof firstContext | typeof secondContext) => Promise<{
            context: typeof firstContext | typeof secondContext;
            host: ReturnType<typeof createHost>;
            transport:
              | typeof firstAttachedTransport
              | typeof secondAttachedTransport;
          }>
        >()
        .mockImplementationOnce(() => firstAttachment.promise)
        .mockImplementationOnce(() => secondAttachment.promise),
      subscribeToHost: vi.fn(() => vi.fn()),
      notifySessionChanged: vi.fn(),
    });

    const firstSwitchPromise = controller.switchContext(
      async () => firstContext,
    );
    const secondSwitchPromise = controller.switchContext(
      async () => secondContext,
    );

    await Promise.resolve();

    firstAttachment.resolve({
      context: firstContext,
      host: createHost("alpha-host"),
      transport: firstAttachedTransport,
    });
    await firstSwitchPromise;

    expect(firstAttachedTransport.closeSpy).toHaveBeenCalledTimes(1);
    expect(state.context).toEqual(secondContext);

    const secondAttachedHost = createHost("beta-host");
    secondAttachment.resolve({
      context: secondContext,
      host: secondAttachedHost,
      transport: secondAttachedTransport,
    });
    await secondSwitchPromise;

    expect(state.host).toBe(secondAttachedHost);
    expect(state.transport).toBe(secondAttachedTransport);
  });

  it("replaces the loading host with an error host when attachment fails", async () => {
    const state = createState();
    const nextContext = createContext("beta", "/tmp/beta");
    const notifySessionChanged = vi.fn();
    const controller = createContextSwitchController(state, {
      attachContext: vi.fn(async () => {
        throw new Error("socket timeout");
      }),
      subscribeToHost: vi.fn(() => vi.fn()),
      notifySessionChanged,
    });

    await controller.switchContext(async () => nextContext);
    await Promise.resolve();

    await expect(state.host.getSnapshot()).resolves.toEqual({
      sessionId: nextContext.thread.id,
      status: "error",
      messages: [],
      lastError: "socket timeout",
    });
    expect(notifySessionChanged).toHaveBeenCalledTimes(2);
    expect(state.transport).toBeNull();
  });

  it("builds lightweight loading and error hosts around the selected thread", async () => {
    const baseHost = createHost("base");
    const context = createContext("beta", "/tmp/beta");
    const loadingHost = createLoadingAgentHost(baseHost, context);
    const errorHost = createFailedAgentHost(baseHost, context, "boom");

    await expect(loadingHost.getSnapshot()).resolves.toEqual({
      sessionId: context.thread.id,
      status: "starting",
      messages: [],
      lastError: null,
    });
    await expect(errorHost.getSnapshot()).resolves.toEqual({
      sessionId: context.thread.id,
      status: "error",
      messages: [],
      lastError: "boom",
    });
    await expect(loadingHost.getProviders()).resolves.toEqual([]);
    await expect(loadingHost.getSettings()).resolves.toEqual({});
    await expect(errorHost.getProviders()).resolves.toEqual([]);
    await expect(errorHost.getSettings()).resolves.toEqual({});

    expect(baseHost.getProviders).not.toHaveBeenCalled();
    expect(baseHost.getSettings).not.toHaveBeenCalled();
  });

  it("does not mark the loading host as streaming while a thread switch is in progress", async () => {
    const baseHost = createHost("base");
    const context = createContext("beta", "/tmp/beta");
    const loadingHost = createLoadingAgentHost(baseHost, context);

    await expect(loadingHost.getSnapshot()).resolves.toMatchObject({
      status: "starting",
      messages: [],
      lastError: null,
    });
  });
});
