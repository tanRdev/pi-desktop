import { describe, expect, it, vi } from "vitest";
import {
  createFailedAgentHost,
  createLoadingAgentHost,
  createSessionCapability,
} from "./session-capability";

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

describe("createSessionCapability", () => {
  it("owns session state without exposing mutable property bags", () => {
    const session = createSessionCapability({
      initialHost: createHost("bootstrap"),
      attachContext: vi.fn(),
      subscribeToHost: vi.fn(() => vi.fn()),
      notifySessionChanged: vi.fn(),
    });

    expect(session.getContext()).toBeNull();
    expect(session.getHost().getSnapshot).toBeTypeOf("function");
    expect(session.getTransport()).toBeNull();
    expect(Object.keys(session)).not.toContain("context");
    expect(Object.keys(session)).not.toContain("host");
  });

  it("switches into a loading host before the awaited attachment completes", async () => {
    const initialHost = createHost("initial-host");
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

    const session = createSessionCapability({
      initialHost,
      attachContext: vi.fn(() => pendingAttachment.promise),
      subscribeToHost,
      notifySessionChanged,
    });

    const switchPromise = session.switchContext(async () => nextContext);
    await Promise.resolve();

    expect(session.getContext()).toEqual(nextContext);
    await expect(session.getHost().getSnapshot()).resolves.toEqual({
      sessionId: nextContext.thread.id,
      status: "starting",
      messages: [],
      lastError: null,
    });
    expect(notifySessionChanged).toHaveBeenCalledTimes(1);

    pendingAttachment.resolve({
      context: nextContext,
      host: attachedHost,
      transport: attachedTransport,
    });
    await switchPromise;

    expect(session.getHost()).toBe(attachedHost);
    expect(session.getTransport()).toBe(attachedTransport);
    expect(subscribeToHost).toHaveBeenCalledWith(
      attachedHost,
      nextContext.thread,
    );
    expect(notifySessionChanged).toHaveBeenCalledTimes(2);
  });

  it("drops stale attachment results when a newer switch starts", async () => {
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

    const session = createSessionCapability({
      initialHost: createHost("initial"),
      attachContext: vi
        .fn()
        .mockImplementationOnce(() => firstAttachment.promise)
        .mockImplementationOnce(() => secondAttachment.promise),
      subscribeToHost: vi.fn(() => vi.fn()),
      notifySessionChanged: vi.fn(),
    });

    const firstSwitchPromise = session.switchContext(async () => firstContext);
    const secondSwitchPromise = session.switchContext(
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
    expect(session.getContext()).toEqual(secondContext);

    const secondAttachedHost = createHost("beta-host");
    secondAttachment.resolve({
      context: secondContext,
      host: secondAttachedHost,
      transport: secondAttachedTransport,
    });
    await secondSwitchPromise;

    expect(session.getHost()).toBe(secondAttachedHost);
    expect(session.getTransport()).toBe(secondAttachedTransport);
  });

  it("replaces the loading host with an error host when attachment fails", async () => {
    const nextContext = createContext("beta", "/tmp/beta");
    const notifySessionChanged = vi.fn();
    const session = createSessionCapability({
      initialHost: createHost("initial"),
      attachContext: vi.fn(async () => {
        throw new Error("socket timeout");
      }),
      subscribeToHost: vi.fn(() => vi.fn()),
      notifySessionChanged,
    });

    await session.switchContext(async () => nextContext);

    await expect(session.getHost().getSnapshot()).resolves.toEqual({
      sessionId: nextContext.thread.id,
      status: "error",
      messages: [],
      lastError: "socket timeout",
    });
    expect(notifySessionChanged).toHaveBeenCalledTimes(2);
    expect(session.getTransport()).toBeNull();
  });

  it("commits an attachment and closes the previous transport", () => {
    const previousTransport = createTransport();
    const previousUnsubscribe = vi.fn();
    const nextContext = createContext("gamma", "/tmp/gamma");
    const nextHost = createHost("gamma-host");
    const nextTransport = createTransport();
    const nextUnsubscribe = vi.fn();
    const subscribeToHost = vi.fn(() => nextUnsubscribe);

    const session = createSessionCapability({
      initialHost: createHost("initial"),
      attachContext: vi.fn(),
      subscribeToHost,
      notifySessionChanged: vi.fn(),
    });

    session.replaceHost(createHost("seed"), {
      context: createContext("seed", "/tmp/seed"),
      transport: previousTransport,
      subscribe: () => previousUnsubscribe,
    });

    session.commitAttachment({
      context: nextContext,
      host: nextHost,
      transport: nextTransport,
    });

    expect(session.getContext()).toEqual(nextContext);
    expect(session.getHost()).toBe(nextHost);
    expect(session.getTransport()).toBe(nextTransport);
    expect(previousUnsubscribe).toHaveBeenCalledTimes(1);
    expect(previousTransport.closeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeToHost).toHaveBeenCalledWith(nextHost, nextContext.thread);
  });

  it("clears the session for worktree selection without a thread", () => {
    const transport = createTransport();
    const unsubscribe = vi.fn();
    const replacement = createHost("empty");
    const session = createSessionCapability({
      initialHost: createHost("initial"),
      attachContext: vi.fn(),
      subscribeToHost: vi.fn(() => vi.fn()),
      notifySessionChanged: vi.fn(),
    });

    session.replaceHost(createHost("seed"), {
      context: createContext("seed", "/tmp/seed"),
      transport,
      subscribe: () => unsubscribe,
    });
    session.clearSession(replacement);

    expect(session.getContext()).toBeNull();
    expect(session.getHost()).toBe(replacement);
    expect(session.getTransport()).toBeNull();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(transport.closeSpy).toHaveBeenCalledTimes(1);
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
  });
});
