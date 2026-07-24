import type { PiDesktopApi } from "@pi-desktop/shared";
import { useCallback, useEffect, useState } from "react";

// Mirrors apps/desktop/src/main/auto-updater.ts without importing from main.
// TODO(A6): once the shared package exports an `UpdaterState` type and the preload
// API surfaces `window.piDesktop.updates`, replace these local duplicates with the
// canonical shared types and the typed API bridge.

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "restart-pending"
  | "error";

export interface UpdateInfoSnapshot {
  readonly version: string;
  readonly releaseNotes?: string | null;
  readonly releaseName?: string | null;
  readonly releaseDate?: string | null;
}

export interface UpdaterErrorInfo {
  readonly message: string;
  readonly attempt: number;
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

export interface UpdaterActions {
  check(): Promise<void>;
  download(): Promise<void>;
  install(): void;
  dismissError(): void;
}

export interface UpdaterHookResult {
  state: UpdaterState;
  actions: UpdaterActions;
  isAvailable: boolean;
  isDownloaded: boolean;
  isError: boolean;
}

interface UpdatesBridge {
  getState?: () => Promise<UpdaterState>;
  check?: () => Promise<UpdaterState>;
  download?: () => Promise<UpdaterState>;
  install?: () => Promise<UpdaterState> | UpdaterState | undefined;
  subscribe?: (listener: (state: UpdaterState) => void) => () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUpdaterState(value: unknown): value is UpdaterState {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.status === "string";
}

function asGetState(value: unknown): UpdatesBridge["getState"] {
  if (typeof value !== "function") {
    return undefined;
  }
  return async () => {
    const result = await value();
    if (!isUpdaterState(result)) {
      return initialState();
    }
    return result;
  };
}

function asActionCall(
  value: unknown,
): (() => Promise<UpdaterState>) | undefined {
  if (typeof value !== "function") {
    return undefined;
  }
  return async () => {
    const result = await value();
    if (!isUpdaterState(result)) {
      return initialState();
    }
    return result;
  };
}

function asInstall(value: unknown): UpdatesBridge["install"] {
  if (typeof value !== "function") {
    return undefined;
  }
  return () => {
    const result = value();
    return result === undefined ? undefined : result;
  };
}

function asSubscribe(value: unknown): UpdatesBridge["subscribe"] {
  if (typeof value !== "function") {
    return undefined;
  }
  return (listener) => {
    const result = value((payload: unknown) => {
      if (isUpdaterState(payload)) {
        listener(payload);
      }
    });
    if (typeof result === "function") {
      return () => {
        result();
      };
    }
    return () => {};
  };
}

function getBridge(): UpdatesBridge | null {
  if (typeof window === "undefined") {
    return null;
  }
  const api = window.piDesktop as PiDesktopApi & {
    updates?: Record<string, unknown>;
  };
  const candidate = api.updates;
  if (!candidate) {
    return null;
  }
  return {
    getState: asGetState(candidate.getState),
    check: asActionCall(candidate.check),
    download: asActionCall(candidate.download),
    install: asInstall(candidate.install),
    subscribe: asSubscribe(candidate.subscribe),
  };
}

function initialState(): UpdaterState {
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

export function useUpdater(): UpdaterHookResult {
  const [state, setState] = useState<UpdaterState>(initialState);
  const [dismissedErrorAttempt, setDismissedErrorAttempt] = useState<number>(0);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) {
      return;
    }
    let cancelled = false;

    if (bridge.getState) {
      void bridge
        .getState()
        .then((value) => {
          if (!cancelled) {
            setState(value);
          }
        })
        .catch(() => {});
    }

    const unsubscribe = bridge.subscribe?.((value) => {
      setState(value);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const check = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge?.check) {
      return;
    }
    const next = await bridge.check();
    setState(next);
  }, []);

  const download = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge?.download) {
      return;
    }
    const next = await bridge.download();
    setState(next);
  }, []);

  const install = useCallback(() => {
    const bridge = getBridge();
    if (!bridge?.install) {
      return;
    }
    void bridge.install();
  }, []);

  const dismissError = useCallback(() => {
    setDismissedErrorAttempt((prev) =>
      state.error ? state.error.attempt : prev,
    );
  }, [state.error]);

  const isError =
    state.status === "error" &&
    state.error !== null &&
    state.error.attempt > dismissedErrorAttempt;

  return {
    state,
    actions: { check, download, install, dismissError },
    isAvailable: state.status === "available",
    isDownloaded: state.status === "downloaded",
    isError,
  };
}
