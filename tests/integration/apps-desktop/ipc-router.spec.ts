import { describe, expect, it, vi } from "vitest";
import { registerIpcHandlers } from "../../../apps/desktop/src/main/ipc-router";
import {
  type AgentSnapshot,
  IPC_CHANNELS,
  type ShellSnapshot,
} from "../../../packages/shared/src";

describe("registerIpcHandlers", () => {
  it("binds shell and agent handlers to the expected invoke channels", async () => {
    const handlers = new Map<
      string,
      (event?: unknown, payload?: unknown) => Promise<unknown>
    >();
    const shellSnapshot: ShellSnapshot = {
      appName: "PiDesk",
      appVersion: "0.1.0",
      chromeVersion: "41.0.1",
      platform: "darwin",
      mode: "test",
      runtime: {
        agentMode: "mock",
        electronVersion: "41.0.1",
      },
      workspace: {
        rootPath: "/tmp/pidesk",
        agentDirectory: "/tmp/pidesk/.pidesk-agent",
        projects: [
          {
            id: "/tmp/pidesk",
            name: "pidesk",
            path: "/tmp/pidesk",
            isActive: true,
          },
        ],
      },
      capabilities: {
        supportsTurns: true,
        supportsTools: true,
        supportsActivity: true,
        supportsParallelSessions: false,
      },
    };
    const agentSnapshot: AgentSnapshot = {
      sessionId: "mock-session",
      status: "ready",
      messages: [],
      lastError: null,
    };

    const getShellSnapshot = vi.fn(() => shellSnapshot);
    const agentHost = {
      getSnapshot: vi.fn(async () => agentSnapshot),
      prompt: vi.fn(async () => undefined),
    };

    registerIpcHandlers({
      handle: (channel, listener) => {
        handlers.set(channel, async (event, payload) =>
          listener(event, payload),
        );
      },
      getShellSnapshot,
      agentHost,
    });

    await expect(
      handlers.get(IPC_CHANNELS.shell.getSnapshot)?.(),
    ).resolves.toEqual(shellSnapshot);
    await expect(
      handlers.get(IPC_CHANNELS.agent.getSnapshot)?.(),
    ).resolves.toEqual(agentSnapshot);

    await handlers.get(IPC_CHANNELS.agent.prompt)?.(
      { sender: "electron-ipc-event" },
      { text: "Inspect the workspace" },
    );

    expect(getShellSnapshot).toHaveBeenCalledTimes(1);
    expect(agentHost.getSnapshot).toHaveBeenCalledTimes(1);
    expect(agentHost.prompt).toHaveBeenCalledWith("Inspect the workspace");
  });
});
