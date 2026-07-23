import {
  createContractInvoker,
  createContractSubscriber,
  updatesContracts,
} from "@pi-desktop/contracts";
import { IPC_CHANNELS } from "@pi-desktop/shared";

export type PreloadInvoke = <TReturn>(
  channel: string,
  payload?: unknown,
) => Promise<TReturn>;

export type PreloadOn = (
  channel: string,
  listener: (payload: unknown) => void,
) => () => void;

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

/** @deprecated Prefer IPC_CHANNELS.updates — kept for tests that import channel constants. */
export const UPDATE_IPC_CHANNELS = IPC_CHANNELS.updates;

export function createUpdatesApi({
  invoke,
  on,
}: {
  invoke: PreloadInvoke;
  on: PreloadOn;
}): UpdatesApi {
  const invokeContract = createContractInvoker(invoke);
  const subscribeContract = createContractSubscriber(on);

  return {
    getState() {
      return invokeContract(updatesContracts.getState) as Promise<UpdaterState>;
    },
    check() {
      return invokeContract(updatesContracts.check) as Promise<UpdaterState>;
    },
    download() {
      return invokeContract(updatesContracts.download) as Promise<UpdaterState>;
    },
    install() {
      void invokeContract(updatesContracts.install);
    },
    subscribe(listener: (state: UpdaterState) => void) {
      return subscribeContract(updatesContracts.event, (state) => {
        listener(state as UpdaterState);
      });
    },
  };
}
