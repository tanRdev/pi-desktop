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
      preflightResult: expect.any(Function),
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

  it("forwards images and resolves on preflight acceptance while the turn is still running", async () => {
    const setStreamingState = vi.fn();
    const refreshReadyState = vi.fn();
    const setErrorState = vi.fn();
    const turnGate = createDeferred<void>();
    let reportPreflight: ((success: boolean) => void) | undefined;

    const session = {
      sessionId: "session-1",
      prompt: vi.fn((_text: string, options?: object) => {
        const preflight = options
          ? Reflect.get(options, "preflightResult")
          : undefined;
        reportPreflight =
          typeof preflight === "function"
            ? (success: boolean) => preflight(success)
            : undefined;
        return turnGate.promise;
      }),
    };

    const lifecycle = createPiSdkPromptLifecycle({
      getSession: () => session,
      setStreamingState,
      refreshReadyState,
      setErrorState,
    });

    const images = [
      {
        type: "image" as const,
        mimeType: "image/png" as const,
        data: "aGVsbG8=",
      },
    ];
    const promptPromise = lifecycle.prompt("hello", images);
    expect(session.prompt).toHaveBeenCalledWith("hello", {
      signal: expect.any(AbortSignal),
      preflightResult: expect.any(Function),
      images,
    });
    reportPreflight?.(true);

    // Acceptance resolves the call even though the turn has not finished.
    await expect(promptPromise).resolves.toBeUndefined();
    expect(refreshReadyState).not.toHaveBeenCalled();
    expect(setErrorState).not.toHaveBeenCalled();

    turnGate.resolve(undefined);
    await vi.waitFor(() => {
      expect(refreshReadyState).toHaveBeenCalledOnce();
    });
    expect(setErrorState).not.toHaveBeenCalled();
  });

  it("records failures after acceptance as error state instead of rejecting the accepted call", async () => {
    const setStreamingState = vi.fn();
    const refreshReadyState = vi.fn();
    const setErrorState = vi.fn();
    const turnGate = createDeferred<void>();
    const failure = new Error("turn exploded");

    const session = {
      sessionId: "session-7",
      prompt: vi.fn((_text: string, options?: object) => {
        const preflight = options
          ? Reflect.get(options, "preflightResult")
          : undefined;
        if (typeof preflight === "function") {
          preflight(true);
        }
        return turnGate.promise;
      }),
    };

    const lifecycle = createPiSdkPromptLifecycle({
      getSession: () => session,
      setStreamingState,
      refreshReadyState,
      setErrorState,
    });

    await expect(lifecycle.prompt("hello")).resolves.toBeUndefined();

    turnGate.reject(failure);
    await vi.waitFor(() => {
      expect(setErrorState).toHaveBeenCalledWith(failure, "session-7");
    });
    expect(refreshReadyState).not.toHaveBeenCalled();
  });

  it("rejects when the prompt fails before preflight acceptance", async () => {
    const setStreamingState = vi.fn();
    const refreshReadyState = vi.fn();
    const setErrorState = vi.fn();
    const failure = new Error("no model selected");

    const session = {
      sessionId: "session-9",
      prompt: vi.fn(async (_text: string, options?: object) => {
        const preflight = options
          ? Reflect.get(options, "preflightResult")
          : undefined;
        if (typeof preflight === "function") {
          preflight(false);
        }
        throw failure;
      }),
    };

    const lifecycle = createPiSdkPromptLifecycle({
      getSession: () => session,
      setStreamingState,
      refreshReadyState,
      setErrorState,
    });

    await expect(lifecycle.prompt("hello")).rejects.toThrow(
      "no model selected",
    );
    expect(setErrorState).toHaveBeenCalledWith(failure, "session-9");
    expect(refreshReadyState).not.toHaveBeenCalled();
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
