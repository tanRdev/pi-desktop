import { describe, expect, it, vi } from "vitest";

import { registerDesktopAppLifecycle } from "./app-lifecycle";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

describe("registerDesktopAppLifecycle", () => {
  it("initializes the packaged updater and shuts down resources before exit", async () => {
    const willQuitHandlers: Array<(event: { preventDefault(): void }) => void> =
      [];
    const activateHandlers: Array<() => Promise<void> | void> = [];
    const windowClosedHandlers: Array<() => void> = [];
    const preventDefault = vi.fn();
    const unsubscribeHost = vi.fn();
    const closeCurrentTransport = vi.fn();
    const runtimeCleanup = createDeferred<void>();
    const terminalCleanup = createDeferred<void>();
    const persistenceCleanup = createDeferred<void>();
    const didExit = createDeferred<void>();
    const terminateAll = vi.fn(() => runtimeCleanup.promise);
    const destroyAllAsync = vi.fn(() => terminalCleanup.promise);
    const flushPersistentState = vi.fn(() => persistenceCleanup.promise);
    const exit = vi.fn(() => didExit.resolve());
    const quit = vi.fn();
    const initAutoUpdater = vi.fn();
    const createTrackedMainWindow = vi.fn(async () => ({ id: "window-2" }));

    registerDesktopAppLifecycle({
      app: {
        isPackaged: true,
        once: vi.fn((event, listener) => {
          if (event === "will-quit") {
            willQuitHandlers.push(listener);
          }
        }),
        on: vi.fn((event, listener) => {
          if (event === "activate") {
            activateHandlers.push(listener);
          }
          if (event === "window-all-closed") {
            windowClosedHandlers.push(listener);
          }
        }),
        exit,
        quit,
      },
      browserWindow: {
        getAllWindows: vi.fn(() => []),
      },
      getMainWindow: () => ({ id: "window-1" }),
      createTrackedMainWindow,
      initAutoUpdater,
      terminalManager: {
        destroyAllAsync,
      },
      runtimeManager: {
        terminateAll,
      },
      flushPersistentState,
      unsubscribeHost,
      closeCurrentTransport,
      shouldQuitWhenAllWindowsClosed: vi.fn(() => true),
      env: {},
      platform: "darwin",
      logShutdownError: vi.fn(),
    });

    expect(initAutoUpdater).toHaveBeenCalledWith({
      mainWindow: {
        getMainWindow: expect.any(Function),
      },
      consent: {
        shouldAutoDownload: expect.any(Function),
      },
    });

    const updaterInput = initAutoUpdater.mock.calls[0]?.[0];
    expect(updaterInput?.consent.shouldAutoDownload()).toBe(false);
    expect(updaterInput?.mainWindow.getMainWindow()).toEqual({
      id: "window-1",
    });

    const willQuit = willQuitHandlers[0];
    expect(willQuit).toBeTypeOf("function");

    await willQuit?.({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(unsubscribeHost).toHaveBeenCalledTimes(1);
    expect(closeCurrentTransport).toHaveBeenCalledTimes(1);
    expect(terminateAll).toHaveBeenCalledTimes(1);
    expect(destroyAllAsync).toHaveBeenCalledTimes(1);
    expect(flushPersistentState).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();

    runtimeCleanup.resolve();
    terminalCleanup.resolve();
    await Promise.resolve();

    expect(exit).not.toHaveBeenCalled();

    persistenceCleanup.resolve();
    await didExit.promise;
    expect(exit).toHaveBeenCalledWith(0);
    expect(quit).not.toHaveBeenCalled();
  });

  it("logs every rejected shutdown cleanup before exiting", async () => {
    const willQuitHandlers: Array<(event: { preventDefault(): void }) => void> =
      [];
    const runtimeCleanup = createDeferred<void>();
    const terminalCleanup = createDeferred<void>();
    const persistenceCleanup = createDeferred<void>();
    const didExit = createDeferred<void>();
    const logShutdownError = vi.fn();
    const exit = vi.fn(() => didExit.resolve());

    registerDesktopAppLifecycle({
      app: {
        isPackaged: false,
        once: vi.fn((event, listener) => {
          if (event === "will-quit") {
            willQuitHandlers.push(listener);
          }
        }),
        on: vi.fn(),
        exit,
        quit: vi.fn(),
      },
      browserWindow: {
        getAllWindows: vi.fn(() => []),
      },
      getMainWindow: () => null,
      createTrackedMainWindow: vi.fn(async () => ({ id: "window" })),
      initAutoUpdater: vi.fn(),
      terminalManager: {
        destroyAllAsync: () => terminalCleanup.promise,
      },
      runtimeManager: {
        terminateAll: () => runtimeCleanup.promise,
      },
      flushPersistentState: () => persistenceCleanup.promise,
      unsubscribeHost: vi.fn(),
      closeCurrentTransport: vi.fn(),
      shouldQuitWhenAllWindowsClosed: vi.fn(() => false),
      env: {},
      platform: "linux",
      logShutdownError,
    });

    willQuitHandlers[0]?.({ preventDefault: vi.fn() });

    const runtimeError = new Error("runtime cleanup failed");
    const terminalError = new Error("terminal cleanup failed");
    const persistenceError = new Error("persistence cleanup failed");
    runtimeCleanup.reject(runtimeError);
    terminalCleanup.reject(terminalError);
    await Promise.resolve();

    expect(exit).not.toHaveBeenCalled();

    persistenceCleanup.reject(persistenceError);
    await didExit.promise;

    expect(logShutdownError.mock.calls).toEqual([
      [runtimeError],
      [terminalError],
      [persistenceError],
    ]);
    expect(
      logShutdownError.mock.invocationCallOrder.every(
        (order) => order < (exit.mock.invocationCallOrder[0] ?? 0),
      ),
    ).toBe(true);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("reads auto-download consent from shouldAutoDownloadUpdates", () => {
    const initAutoUpdater = vi.fn();

    registerDesktopAppLifecycle({
      app: {
        isPackaged: true,
        once: vi.fn(),
        on: vi.fn(),
        exit: vi.fn(),
        quit: vi.fn(),
      },
      browserWindow: {
        getAllWindows: vi.fn(() => []),
      },
      getMainWindow: () => null,
      createTrackedMainWindow: vi.fn(async () => ({ id: "w" })),
      initAutoUpdater,
      shouldAutoDownloadUpdates: () => true,
      terminalManager: {
        destroyAllAsync: vi.fn(async () => undefined),
      },
      runtimeManager: {
        terminateAll: vi.fn(async () => undefined),
      },
      flushPersistentState: vi.fn(async () => undefined),
      unsubscribeHost: vi.fn(),
      closeCurrentTransport: vi.fn(),
      shouldQuitWhenAllWindowsClosed: vi.fn(() => true),
      env: {},
      platform: "darwin",
      logShutdownError: vi.fn(),
    });

    const updaterInput = initAutoUpdater.mock.calls[0]?.[0];
    expect(updaterInput?.consent.shouldAutoDownload()).toBe(true);
  });

  it("registers the stub updater in development and recreates the main window on activate", async () => {
    const activateHandlers: Array<() => Promise<void> | void> = [];
    const initAutoUpdater = vi.fn();
    const createTrackedMainWindow = vi.fn(async () => ({ id: "window-2" }));

    registerDesktopAppLifecycle({
      app: {
        isPackaged: false,
        once: vi.fn(),
        on: vi.fn((event, listener) => {
          if (event === "activate") {
            activateHandlers.push(listener);
          }
        }),
        exit: vi.fn(),
        quit: vi.fn(),
      },
      browserWindow: {
        getAllWindows: vi.fn(() => []),
      },
      getMainWindow: () => null,
      createTrackedMainWindow,
      initAutoUpdater,
      terminalManager: {
        destroyAllAsync: vi.fn(async () => undefined),
      },
      runtimeManager: {
        terminateAll: vi.fn(async () => undefined),
      },
      flushPersistentState: vi.fn(async () => undefined),
      unsubscribeHost: vi.fn(),
      closeCurrentTransport: vi.fn(),
      shouldQuitWhenAllWindowsClosed: vi.fn(() => false),
      env: {},
      platform: "linux",
      logShutdownError: vi.fn(),
    });

    expect(initAutoUpdater).toHaveBeenCalledWith();

    const activate = activateHandlers[0];
    expect(activate).toBeTypeOf("function");

    await activate?.();

    expect(createTrackedMainWindow).toHaveBeenCalledTimes(1);
  });

  it("quits only when the window-all-closed policy allows it", () => {
    const windowClosedHandlers: Array<() => void> = [];
    const quit = vi.fn();

    registerDesktopAppLifecycle({
      app: {
        isPackaged: false,
        once: vi.fn(),
        on: vi.fn((event, listener) => {
          if (event === "window-all-closed") {
            windowClosedHandlers.push(listener);
          }
        }),
        exit: vi.fn(),
        quit,
      },
      browserWindow: {
        getAllWindows: vi.fn(() => [{ id: "window-1" }]),
      },
      getMainWindow: () => ({ id: "window-1" }),
      createTrackedMainWindow: vi.fn(async () => ({ id: "window-2" })),
      initAutoUpdater: vi.fn(),
      terminalManager: {
        destroyAllAsync: vi.fn(async () => undefined),
      },
      runtimeManager: {
        terminateAll: vi.fn(async () => undefined),
      },
      flushPersistentState: vi.fn(async () => undefined),
      unsubscribeHost: vi.fn(),
      closeCurrentTransport: vi.fn(),
      shouldQuitWhenAllWindowsClosed: vi.fn(() => true),
      env: { NODE_ENV: "production" },
      platform: "linux",
      logShutdownError: vi.fn(),
    });

    const onWindowAllClosed = windowClosedHandlers[0];
    expect(onWindowAllClosed).toBeTypeOf("function");

    onWindowAllClosed?.();

    expect(quit).toHaveBeenCalledTimes(1);
  });
});
