import { describe, expect, it, vi } from "vitest";

import { createPiSdkPromptLifecycle } from "./pi-sdk-prompt-lifecycle.js";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
};

describe("createPiSdkPromptLifecycle", () => {
  it("runs prompts with an AbortSignal and refreshes ready state after success", async () => {
    const setStreamingState = vi.fn();
    const refreshReadyState = vi.fn();
    const setErrorState = vi.fn();
    let capturedSignal: AbortSignal | undefined;

    const session = {
      sessionId: "session-1",
      prompt: vi.fn(async (_text: string, options?: object) => {
        const signal = options ? Reflect.get(options, "signal") : undefined;
        capturedSignal = signal instanceof AbortSignal ? signal : undefined;
      }),
    };

    const lifecycle = createPiSdkPromptLifecycle({
      getSession: () => session,
      setStreamingState,
      refreshReadyState,
      setErrorState,
    });

    await lifecycle.prompt("hello");

    expect(setStreamingState).toHaveBeenCalledOnce();
    expect(session.prompt).toHaveBeenCalledOnce();
    expect(session.prompt).toHaveBeenCalledWith("hello", {
      signal: expect.any(AbortSignal),
    });
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(refreshReadyState).toHaveBeenCalledOnce();
    expect(setErrorState).not.toHaveBeenCalled();
  });

  it("aborts the active prompt, waits for idle, and keeps aborts out of error state", async () => {
    const setStreamingState = vi.fn();
    const refreshReadyState = vi.fn();
    const setErrorState = vi.fn();
    const promptStarted = createDeferred<void>();
    let capturedSignal: AbortSignal | undefined;

    const session = {
      sessionId: "session-1",
      prompt: vi.fn((_text: string, options?: object) => {
        const signal = options ? Reflect.get(options, "signal") : undefined;
        capturedSignal = signal instanceof AbortSignal ? signal : undefined;
        promptStarted.resolve(undefined);

        return new Promise<void>((_resolve, reject) => {
          capturedSignal?.addEventListener("abort", () => {
            reject(new Error("prompt aborted"));
          });
        });
      }),
      waitForIdle: vi.fn(async () => {
        throw new Error("ignore idle rejection");
      }),
    };

    const lifecycle = createPiSdkPromptLifecycle({
      getSession: () => session,
      setStreamingState,
      refreshReadyState,
      setErrorState,
    });

    const promptPromise = lifecycle.prompt("hello");
    await promptStarted.promise;

    await lifecycle.cancel();
    await expect(promptPromise).resolves.toBeUndefined();

    expect(capturedSignal?.aborted).toBe(true);
    expect(session.waitForIdle).toHaveBeenCalledOnce();
    expect(refreshReadyState).toHaveBeenCalledTimes(2);
    expect(setErrorState).not.toHaveBeenCalled();
  });

  it("records prompt failures with the current session id and rethrows the error", async () => {
    const error = new Error("prompt failed");
    const setStreamingState = vi.fn();
    const refreshReadyState = vi.fn();
    const setErrorState = vi.fn();

    const session = {
      sessionId: "session-42",
      prompt: vi.fn(async () => {
        throw error;
      }),
    };

    const lifecycle = createPiSdkPromptLifecycle({
      getSession: () => session,
      setStreamingState,
      refreshReadyState,
      setErrorState,
    });

    await expect(lifecycle.prompt("hello")).rejects.toThrow("prompt failed");

    expect(setStreamingState).toHaveBeenCalledOnce();
    expect(setErrorState).toHaveBeenCalledWith(error, "session-42");
    expect(refreshReadyState).not.toHaveBeenCalled();
  });
});
