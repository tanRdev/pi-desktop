import { describe, expect, it, vi } from "vitest";

import { registerDesktopAppLifecycle } from "./app-lifecycle";

describe("registerDesktopAppLifecycle", () => {
  it("initializes the packaged updater and shuts down resources before exit", async () => {
    const willQuitHandlers: Array<(event: { preventDefault(): void }) => void> =
      [];
    const activateHandlers: Array<() => Promise<void> | void> = [];
    const windowClosedHandlers: Array<() => void> = [];
    const preventDefault = vi.fn();
    const unsubscribeHost = vi.fn();
    const closeCurrentTransport = vi.fn();
    const destroyAllAsync = vi.fn(async () => undefined);
    const flushPersistentState = vi.fn(async () => undefined);
    const exit = vi.fn();
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
    expect(destroyAllAsync).toHaveBeenCalledTimes(1);
    expect(flushPersistentState).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(exit).toHaveBeenCalledWith(0);
    expect(quit).not.toHaveBeenCalled();
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
