import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

// TODO(A6): these channels are defined locally because packages/shared/src/ipc/channels.ts
// is owned by agent A6. Once A6 adds an `updates` namespace to IPC_CHANNELS, replace
// these string literals with IPC_CHANNELS.updates.*. Channel names below are the
// canonical values agents downstream should expect.
export const UPDATE_IPC_CHANNELS = {
  event: "updates:event",
  getState: "updates:getState",
  check: "updates:check",
  download: "updates:download",
  install: "updates:install",
} as const;

// TODO(A3/A6): `autoDownloadUpdates` preference key is used here. Agent A3 (Settings Panel)
// and A6 (shared models) should extend AppPreferences with this optional boolean. Until
// then we consult the raw preferences map via a duck-typed accessor so this code compiles
// without touching the shared model.

// ---------------------------------------------------------------------------
// Pure state machine (exported for tests)
// ---------------------------------------------------------------------------

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "restart-pending"
  | "error";

export interface UpdaterErrorInfo {
  readonly message: string;
  readonly attempt: number;
}

export interface UpdateInfoSnapshot {
  readonly version: string;
  readonly releaseNotes?: string | null;
  readonly releaseName?: string | null;
  readonly releaseDate?: string | null;
}

export interface UpdaterState {
  readonly status: UpdaterStatus;
  readonly updateInfo: UpdateInfoSnapshot | null;
  readonly downloadPercent: number;
  readonly error: UpdaterErrorInfo | null;
  readonly errorCount: number;
  readonly lastCheckAt: number | null;
  readonly userConsented: boolean;
}

export type UpdaterEvent =
  | { type: "CHECK_START" }
  | { type: "CHECK_COMPLETE_NO_UPDATE" }
  | { type: "UPDATE_AVAILABLE"; info: UpdateInfoSnapshot }
  | { type: "DOWNLOAD_START" }
  | { type: "DOWNLOAD_PROGRESS"; percent: number }
  | { type: "DOWNLOAD_COMPLETE" }
  | { type: "INSTALL_REQUESTED" }
  | { type: "ERROR"; message: string }
  | { type: "RESET" }
  | { type: "CONSENT_SET"; consented: boolean };

export function createInitialUpdaterState(): UpdaterState {
  return {
    status: "idle",
    updateInfo: null,
    downloadPercent: 0,
    error: null,
    errorCount: 0,
    lastCheckAt: null,
    userConsented: false,
  };
}

export function updaterReducer(
  state: UpdaterState,
  event: UpdaterEvent,
): UpdaterState {
  switch (event.type) {
    case "CHECK_START": {
      if (
        state.status === "downloading" ||
        state.status === "downloaded" ||
        state.status === "restart-pending"
      ) {
        return state;
      }
      return {
        ...state,
        status: "checking",
        error: null,
        lastCheckAt: Date.now(),
      };
    }
    case "CHECK_COMPLETE_NO_UPDATE": {
      if (state.status !== "checking") {
        return state;
      }
      return {
        ...state,
        status: "idle",
        errorCount: 0,
      };
    }
    case "UPDATE_AVAILABLE": {
      return {
        ...state,
        status: "available",
        updateInfo: event.info,
        errorCount: 0,
        error: null,
      };
    }
    case "DOWNLOAD_START": {
      if (state.status !== "available" && state.status !== "error") {
        return state;
      }
      return {
        ...state,
        status: "downloading",
        downloadPercent: 0,
        error: null,
      };
    }
    case "DOWNLOAD_PROGRESS": {
      if (state.status !== "downloading") {
        return state;
      }
      const clamped = Math.min(100, Math.max(0, event.percent));
      return { ...state, downloadPercent: clamped };
    }
    case "DOWNLOAD_COMPLETE": {
      return {
        ...state,
        status: "downloaded",
        downloadPercent: 100,
        errorCount: 0,
      };
    }
    case "INSTALL_REQUESTED": {
      if (state.status !== "downloaded") {
        return state;
      }
      return { ...state, status: "restart-pending" };
    }
    case "ERROR": {
      return {
        ...state,
        status: "error",
        error: {
          message: event.message,
          attempt: state.errorCount + 1,
        },
        errorCount: state.errorCount + 1,
      };
    }
    case "RESET": {
      return {
        ...createInitialUpdaterState(),
        userConsented: state.userConsented,
      };
    }
    case "CONSENT_SET": {
      return { ...state, userConsented: event.consented };
    }
    default: {
      return state;
    }
  }
}

// ---------------------------------------------------------------------------
// Exponential backoff
// ---------------------------------------------------------------------------

export interface BackoffConfig {
  readonly baseMs: number;
  readonly maxMs: number;
  readonly factor: number;
}

export const DEFAULT_BACKOFF: BackoffConfig = {
  baseMs: 30_000,
  maxMs: 6 * 60 * 60 * 1000, // 6h
  factor: 2,
};

export function computeBackoff(
  attempt: number,
  config: BackoffConfig = DEFAULT_BACKOFF,
): number {
  if (attempt <= 0) {
    return config.baseMs;
  }
  const exp = config.baseMs * config.factor ** (attempt - 1);
  return Math.min(config.maxMs, exp);
}

// ---------------------------------------------------------------------------
// Runtime integration
// ---------------------------------------------------------------------------

const INITIAL_CHECK_DELAY_MS = 5_000;
const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4h

export interface ConsentProvider {
  shouldAutoDownload(): boolean;
}

export interface MainWindowProvider {
  getMainWindow(): BrowserWindow | null;
}

export interface InitAutoUpdaterOptions {
  mainWindow: MainWindowProvider;
  consent: ConsentProvider;
  backoff?: BackoffConfig;
}

interface UpdaterRuntime {
  getState(): UpdaterState;
  dispose(): void;
  checkNow(): Promise<void>;
  downloadNow(): Promise<void>;
  installNow(): void;
}

function toUpdateInfoSnapshot(info: {
  version: string;
  releaseNotes?: string | Array<unknown> | null;
  releaseName?: string | null;
  releaseDate?: string;
}): UpdateInfoSnapshot {
  const notes =
    typeof info.releaseNotes === "string" ? info.releaseNotes : null;
  return {
    version: info.version,
    releaseNotes: notes,
    releaseName: info.releaseName ?? null,
    releaseDate: info.releaseDate ?? null,
  };
}

function errorMessageOf(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return "Unknown updater error";
}

export function initAutoUpdater(
  options?: InitAutoUpdaterOptions,
): UpdaterRuntime {
  // Legacy no-arg signature: keep a minimal runtime without IPC wiring for callers
  // that have not migrated yet. The main index.ts calls this without options today.
  const backoff = options?.backoff ?? DEFAULT_BACKOFF;
  let state = createInitialUpdaterState();
  const listeners = new Set<(s: UpdaterState) => void>();
  let retryTimer: NodeJS.Timeout | null = null;
  let periodicTimer: NodeJS.Timeout | null = null;
  let initialTimer: NodeJS.Timeout | null = null;
  let disposed = false;

  // In dev/unpackaged mode, autoUpdater cannot run (no update server, no signing).
  // Register stub IPC handlers so the renderer's useUpdater hook gets a valid
  // response instead of "No handler registered" errors, then return a minimal
  // runtime without wiring up electron-updater.
  if (!options) {
    const devState: UpdaterState = {
      ...createInitialUpdaterState(),
      status: "idle" as const,
    };
    const handle = (channel: string, handler: () => unknown) => {
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, async () => handler());
    };
    handle(UPDATE_IPC_CHANNELS.getState, () => devState);
    handle(UPDATE_IPC_CHANNELS.check, () => devState);
    handle(UPDATE_IPC_CHANNELS.download, () => devState);
    handle(UPDATE_IPC_CHANNELS.install, () => devState);
    return {
      getState: () => devState,
      dispose: () => {
        disposed = true;
      },
      checkNow: async () => {},
      downloadNow: async () => {},
      installNow: () => {},
    };
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  function broadcast(): void {
    const window = options?.mainWindow.getMainWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    window.webContents.send(UPDATE_IPC_CHANNELS.event, state);
  }

  function dispatch(event: UpdaterEvent): void {
    state = updaterReducer(state, event);
    for (const listener of listeners) {
      listener(state);
    }
    broadcast();
  }

  function clearRetry(): void {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function scheduleRetry(): void {
    if (disposed) {
      return;
    }
    clearRetry();
    const delay = computeBackoff(state.errorCount, backoff);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void performCheck();
    }, delay);
  }

  async function performCheck(): Promise<void> {
    if (disposed) {
      return;
    }
    if (
      state.status === "downloading" ||
      state.status === "downloaded" ||
      state.status === "restart-pending"
    ) {
      return;
    }
    dispatch({ type: "CHECK_START" });
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      dispatch({ type: "ERROR", message: errorMessageOf(err) });
      scheduleRetry();
    }
  }

  async function performDownload(): Promise<void> {
    if (disposed) {
      return;
    }
    if (state.status !== "available" && state.status !== "error") {
      return;
    }
    dispatch({ type: "DOWNLOAD_START" });
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      dispatch({ type: "ERROR", message: errorMessageOf(err) });
      scheduleRetry();
    }
  }

  function performInstall(): void {
    if (state.status !== "downloaded") {
      return;
    }
    dispatch({ type: "INSTALL_REQUESTED" });
    autoUpdater.quitAndInstall();
  }

  autoUpdater.on("checking-for-update", () => {
    if (state.status !== "checking") {
      dispatch({ type: "CHECK_START" });
    }
  });

  autoUpdater.on("update-available", (info) => {
    const snapshot = toUpdateInfoSnapshot({
      version: info.version,
      releaseNotes: info.releaseNotes ?? null,
      releaseName: info.releaseName ?? null,
      releaseDate: info.releaseDate,
    });
    dispatch({ type: "UPDATE_AVAILABLE", info: snapshot });

    const autoDownload = options?.consent.shouldAutoDownload() ?? false;
    if (autoDownload) {
      void performDownload();
    }
  });

  autoUpdater.on("update-not-available", () => {
    dispatch({ type: "CHECK_COMPLETE_NO_UPDATE" });
  });

  autoUpdater.on("download-progress", (progress: { percent?: number }) => {
    const percent = typeof progress.percent === "number" ? progress.percent : 0;
    dispatch({ type: "DOWNLOAD_PROGRESS", percent });
  });

  autoUpdater.on("update-downloaded", () => {
    dispatch({ type: "DOWNLOAD_COMPLETE" });
  });

  autoUpdater.on("error", (err) => {
    dispatch({ type: "ERROR", message: errorMessageOf(err) });
    scheduleRetry();
  });

  // IPC handlers (only wire if we got dependencies)
  if (options) {
    const safeHandle = (
      channel: string,
      handler: () => Promise<unknown> | unknown,
    ): void => {
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, async () => handler());
    };

    safeHandle(UPDATE_IPC_CHANNELS.getState, () => state);
    safeHandle(UPDATE_IPC_CHANNELS.check, async () => {
      await performCheck();
      return state;
    });
    safeHandle(UPDATE_IPC_CHANNELS.download, async () => {
      await performDownload();
      return state;
    });
    safeHandle(UPDATE_IPC_CHANNELS.install, () => {
      performInstall();
      return state;
    });
  }

  initialTimer = setTimeout(() => {
    initialTimer = null;
    void performCheck();
  }, INITIAL_CHECK_DELAY_MS);

  periodicTimer = setInterval(() => {
    void performCheck();
  }, PERIODIC_CHECK_INTERVAL_MS);

  return {
    getState: () => state,
    dispose: () => {
      disposed = true;
      clearRetry();
      if (initialTimer) {
        clearTimeout(initialTimer);
      }
      if (periodicTimer) {
        clearInterval(periodicTimer);
      }
      listeners.clear();
    },
    checkNow: performCheck,
    downloadNow: performDownload,
    installNow: performInstall,
  };
}
