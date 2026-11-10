import { describe, expect, it, vi } from "vitest";
import { createPiDesktopApi } from "./api";

function createPreloadHarness() {
  const invoke = vi.fn(
    async (_channel: string, _payload?: unknown) => undefined,
  );
  const channelListeners = new Map<string, (payload: unknown) => void>();
  const onUnsubscribe = vi.fn();
  const on = vi.fn((channel: string, listener: (payload: unknown) => void) => {
    channelListeners.set(channel, listener);
    return onUnsubscribe;
  });
  const api = createPiDesktopApi({
    invoke: invoke as never,
    on: on as never,
  });
  return { api, invoke, on, onUnsubscribe, channelListeners };
}

describe("createPiDesktopApi fs.watch", () => {
  it("starts a main-process watch through the fs:watch contract", () => {
    const { api, invoke } = createPreloadHarness();

    api.fs.watch("/root", () => undefined);

    expect(invoke).toHaveBeenCalledWith("fs:watch", { path: "/root" });
  });

  it("forwards fs:changed events for the watched root and its descendants only", () => {
    const { api, channelListeners } = createPreloadHarness();
    const listener = vi.fn();
    api.fs.watch("/root", listener);

    const emit = channelListeners.get("fs:changed");
    expect(emit).toBeDefined();

    emit?.({ type: "create", path: "/root/src/new.ts", timestamp: 1 });
    emit?.({ type: "create", path: "/other/src/new.ts", timestamp: 2 });
    emit?.({ type: "delete", path: "/root/old.ts", timestamp: 3 });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, {
      type: "create",
      path: "/root/src/new.ts",
      timestamp: 1,
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      type: "delete",
      path: "/root/old.ts",
      timestamp: 3,
    });
  });

  it("unsubscribe removes the channel listener and invokes fs:unwatch once", () => {
    const { api, invoke, onUnsubscribe } = createPreloadHarness();

    const unsubscribe = api.fs.watch("/root", () => undefined);
    unsubscribe();
    unsubscribe();

    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(
      invoke.mock.calls.filter(([channel]) => channel === "fs:unwatch"),
    ).toEqual([["fs:unwatch", { path: "/root" }]]);
  });
});
