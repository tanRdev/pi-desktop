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
  terminalManager: {
    destroyAllAsync(): Promise<void>;
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
  if (input.app.isPackaged) {
    input.initAutoUpdater({
      mainWindow: {
        getMainWindow: input.getMainWindow,
      },
      consent: {
        shouldAutoDownload: () => false,
      },
    });
  } else {
    input.initAutoUpdater();
  }

  input.app.once("will-quit", (event) => {
    input.unsubscribeHost();
    input.closeCurrentTransport();
    event.preventDefault();

    Promise.allSettled([
      input.terminalManager.destroyAllAsync(),
      input.flushPersistentState(),
    ])
      .catch((error) => {
        input.logShutdownError(error);
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
