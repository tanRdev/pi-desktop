import { describe, expect, it, vi } from "vitest";
import {
  registerPiDesktopApi,
  registerPiDesktopApiFromElectron,
} from "../../../apps/desktop/src/preload/index";
import { IPC_CHANNELS } from "../../../packages/shared/src";

describe("registerPiDesktopApi", () => {
  it("exposes the PiDesk API in the isolated preload context", async () => {
    const exposeInMainWorld = vi.fn();
    const invoke = vi.fn(async () => undefined);
    const on = vi.fn(() => () => undefined);

    registerPiDesktopApi({
      exposeInMainWorld,
      invoke,
      on,
    });

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);

    const [key, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      { agent: { prompt(text: string): Promise<void> } },
    ];

    expect(key).toBe("piDesktop");

    await api.agent.prompt("Open the diff inspector");

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.agent.prompt, {
      text: "Open the diff inspector",
    });
  });

  it("registers the PiDesk API from CommonJS Electron preload bindings", async () => {
    const exposeInMainWorld = vi.fn();
    const invoke = vi.fn(async () => undefined);
    const on = vi.fn(() => () => undefined);
    const removeListener = vi.fn();

    registerPiDesktopApiFromElectron({
      contextBridge: {
        exposeInMainWorld,
      },
      ipcRenderer: {
        invoke,
        on,
        removeListener,
      },
    });

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);

    const [key, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      { agent: { prompt(text: string): Promise<void> } },
    ];

    expect(key).toBe("piDesktop");

    await api.agent.prompt("Open the diff inspector");

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.agent.prompt, {
      text: "Open the diff inspector",
    });
    expect(removeListener).not.toHaveBeenCalled();
  });

  it("exposes oauth helper methods in preload api", async () => {
    const exposeInMainWorld = vi.fn();
    const invoke = vi.fn(async () => undefined);
    const on = vi.fn(() => () => undefined);

    registerPiDesktopApi({
      exposeInMainWorld,
      invoke,
      on,
    });

    const [, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      {
        agent: {
          getOAuthProviders(): Promise<unknown>;
          loginWithOAuth(providerId: string): Promise<void>;
          logoutOAuth(providerId: string): Promise<void>;
        };
      },
    ];

    await api.agent.getOAuthProviders();
    await api.agent.loginWithOAuth("anthropic");
    await api.agent.logoutOAuth("anthropic");

    expect(invoke).toHaveBeenNthCalledWith(
      1,
      IPC_CHANNELS.agent.getOAuthProviders,
      undefined,
    );
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      IPC_CHANNELS.agent.loginWithOAuth,
      { providerId: "anthropic" },
    );
    expect(invoke).toHaveBeenNthCalledWith(3, IPC_CHANNELS.agent.logoutOAuth, {
      providerId: "anthropic",
    });
  });
});
