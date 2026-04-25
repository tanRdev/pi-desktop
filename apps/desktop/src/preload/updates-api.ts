export type PreloadInvoke = <TReturn>(
  channel: string,
  payload?: unknown,
) => Promise<TReturn>;

export type PreloadOn = <TPayload>(
  channel: string,
  listener: (payload: TPayload) => void,
) => () => void;

// TODO(A6): once shared exposes UpdaterState + IPC_CHANNELS.updates, replace
// these locally-mirrored types with the canonical shared ones and add
// `updates` to the PiDesktopApi interface.
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

export interface UpdatesApi {
  getState(): Promise<UpdaterState>;
  check(): Promise<UpdaterState>;
  download(): Promise<UpdaterState>;
  install(): void;
  subscribe(listener: (state: UpdaterState) => void): () => void;
}

// Channel constants mirror apps/desktop/src/main/auto-updater.ts UPDATE_IPC_CHANNELS.
// TODO(A6): consume IPC_CHANNELS.updates.* once shared exports them.
export const UPDATE_IPC_CHANNELS = {
  event: "updates:event",
  getState: "updates:getState",
  check: "updates:check",
  download: "updates:download",
  install: "updates:install",
} as const;

export function createUpdatesApi({
  invoke,
  on,
}: {
  invoke: PreloadInvoke;
  on: PreloadOn;
}): UpdatesApi {
  return {
    getState() {
      return invoke<UpdaterState>(UPDATE_IPC_CHANNELS.getState, undefined);
    },
    check() {
      return invoke<UpdaterState>(UPDATE_IPC_CHANNELS.check, undefined);
    },
    download() {
      return invoke<UpdaterState>(UPDATE_IPC_CHANNELS.download, undefined);
    },
    install() {
      void invoke<UpdaterState>(UPDATE_IPC_CHANNELS.install, undefined);
    },
    subscribe(listener: (state: UpdaterState) => void) {
      return on<UpdaterState>(UPDATE_IPC_CHANNELS.event, listener);
    },
  };
}
