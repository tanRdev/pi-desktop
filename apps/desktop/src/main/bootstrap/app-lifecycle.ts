type AutoUpdaterOptions<TWindow> = {
  mainWindow: {
    getMainWindow(): TWindow | null;
  };
  consent: {
    shouldAutoDownload(): boolean;
  };
};

type AppLike = {
  isPackaged: boolean;
  once(
    event: "will-quit",
    listener: (event: { preventDefault(): void }) => void,
  ): void;
  on(
    event: "will-quit",
    listener: (event: { preventDefault(): void }) => void,
  ): void;
  on(event: "activate", listener: () => Promise<void> | void): void;
  on(event: "window-all-closed", listener: () => void): void;
  exit(code?: number): void;
  quit(): void;
};

type BrowserWindowLike<TWindow> = {
  getAllWindows(): TWindow[];
};

type RegisterDesktopAppLifecycleInput<TWindow> = {
  app: AppLike;
  browserWindow: BrowserWindowLike<TWindow>;
  getMainWindow(): TWindow | null;
  createTrackedMainWindow(): Promise<TWindow>;
  initAutoUpdater(options?: AutoUpdaterOptions<TWindow>): void;
  shouldAutoDownloadUpdates?: () => boolean;
  terminalManager: {
    destroyAllAsync(): Promise<void>;
  };
  runtimeManager: {
    terminateAll(): Promise<void>;
  };
  flushPersistentState(): Promise<void>;
  unsubscribeHost(): void;
  closeCurrentTransport(): void;
  shouldQuitWhenAllWindowsClosed(
    env: Record<string, string | undefined>,
    platform: NodeJS.Platform,
  ): boolean;
  env: Record<string, string | undefined>;
  platform: NodeJS.Platform;
  logShutdownError(error: unknown): void;
};

export function registerDesktopAppLifecycle<TWindow>(
  input: RegisterDesktopAppLifecycleInput<TWindow>,
): void {
  let shutdownPromise: Promise<void> | null = null;

  if (input.app.isPackaged) {
    input.initAutoUpdater({
      mainWindow: {
        getMainWindow: input.getMainWindow,
      },
      consent: {
        shouldAutoDownload: () => input.shouldAutoDownloadUpdates?.() === true,
      },
    });
  } else {
    input.initAutoUpdater();
  }

  input.app.on("will-quit", (event) => {
    event.preventDefault();
    if (shutdownPromise) {
      return;
    }

    const cleanupTasks = [
      () => input.unsubscribeHost(),
      () => input.closeCurrentTransport(),
      () => input.runtimeManager.terminateAll(),
      () => input.terminalManager.destroyAllAsync(),
      () => input.flushPersistentState(),
    ];
    shutdownPromise = Promise.allSettled(
      cleanupTasks.map((cleanup) => Promise.resolve().then(cleanup)),
    )
      .then((results) => {
        for (const result of results) {
          if (result.status === "rejected") {
            input.logShutdownError(result.reason);
          }
        }
      })
      .finally(() => {
        input.app.exit(0);
      });
  });

  input.app.on("activate", async () => {
    if (input.browserWindow.getAllWindows().length === 0) {
      await input.createTrackedMainWindow();
    }
  });

  input.app.on("window-all-closed", () => {
    if (input.shouldQuitWhenAllWindowsClosed(input.env, input.platform)) {
      input.app.quit();
    }
  });
}
