import { describe, expect, it, vi } from "vitest";

import {
  createUpdatesApi,
  type PreloadInvoke,
  type PreloadOn,
  UPDATE_IPC_CHANNELS,
  type UpdaterState,
} from "./updates-api";

function createUpdaterState(
  overrides: Partial<UpdaterState> = {},
): UpdaterState {
  return {
    status: "idle",
    updateInfo: null,
    downloadPercent: 0,
    error: null,
    errorCount: 0,
    lastCheckAt: null,
    userConsented: false,
    ...overrides,
  };
}

describe("createUpdatesApi", () => {
  it("invokes updater state channels", async () => {
    const idleState = createUpdaterState();
    const availableState = createUpdaterState({ status: "available" });
    const downloadedState = createUpdaterState({
      status: "downloaded",
      downloadPercent: 100,
    });
    const invokeCalls: Array<[string, unknown?]> = [];
    const invoke: PreloadInvoke = async <TReturn>(
      channel: string,
      payload?: unknown,
    ) => {
      invokeCalls.push([channel, payload]);

      if (channel === UPDATE_IPC_CHANNELS.getState) {
        return idleState as TReturn;
      }

      if (channel === UPDATE_IPC_CHANNELS.check) {
        return availableState as TReturn;
      }

      if (channel === UPDATE_IPC_CHANNELS.download) {
        return downloadedState as TReturn;
      }

      return undefined as TReturn;
    };

    const updates = createUpdatesApi({
      invoke,
      on: () => () => undefined,
    });

    await expect(updates.getState()).resolves.toEqual(idleState);
    await expect(updates.check()).resolves.toEqual(availableState);
    await expect(updates.download()).resolves.toEqual(downloadedState);

    expect(invokeCalls).toEqual([
      [UPDATE_IPC_CHANNELS.getState, undefined],
      [UPDATE_IPC_CHANNELS.check, undefined],
      [UPDATE_IPC_CHANNELS.download, undefined],
    ]);
  });

  it("fires install without awaiting the updater state result", async () => {
    const invokeCalls: Array<[string, unknown?]> = [];
    const invoke: PreloadInvoke = async <TReturn>(
      channel: string,
      payload?: unknown,
    ) => {
      invokeCalls.push([channel, payload]);
      return undefined as TReturn;
    };

    const updates = createUpdatesApi({
      invoke,
      on: () => () => undefined,
    });

    expect(updates.install()).toBeUndefined();
    expect(invokeCalls).toEqual([[UPDATE_IPC_CHANNELS.install, undefined]]);
  });

  it("subscribes to updater events and returns the unsubscribe callback", () => {
    const event = createUpdaterState({
      status: "downloading",
      downloadPercent: 42,
    });
    const listener = vi.fn();
    const off = vi.fn();
    const on: PreloadOn = <TPayload>(
      channel: string,
      callback: (payload: TPayload) => void,
    ) => {
      expect(channel).toBe(UPDATE_IPC_CHANNELS.event);
      callback(event as TPayload);
      return off;
    };

    const updates = createUpdatesApi({
      invoke: async <TReturn>() => undefined as TReturn,
      on,
    });

    const unsubscribe = updates.subscribe(listener);

    expect(listener).toHaveBeenCalledWith(event);

    unsubscribe();

    expect(off).toHaveBeenCalledTimes(1);
  });
});
