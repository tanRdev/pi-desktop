import { describe, expect, it, vi } from "vitest";
import {
  createContractInvoker,
  registerContractHandler,
  registerContractHandlers,
  snapshotContracts,
} from "../../../packages/contracts/src";
import { IPC_CHANNELS } from "../../../packages/shared/src";

const sampleShellSnapshot = {
  appName: "Pi Desktop",
  appVersion: "0.1.0",
  platform: "darwin",
  chromeVersion: "138.0.0.0",
  mode: "test" as const,
  catalog: {
    repositories: [],
    selection: {
      repositoryId: null,
      worktreeId: null,
      threadId: null,
    },
  },
};

const sampleProviders = [
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      {
        id: "claude",
        name: "Claude",
        providerId: "anthropic",
      },
    ],
  },
];

const sampleSettings = {
  currentProviderId: "anthropic",
  currentModelId: "claude",
};

const sampleAgentSnapshot = {
  sessionId: "session-1",
  status: "ready" as const,
  messages: [],
  lastError: null,
};

describe("snapshotContracts", () => {
  it("invokes no-payload contracts with the contract channel", async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === IPC_CHANNELS.shell.getSnapshot)
        return sampleShellSnapshot;
      if (channel === IPC_CHANNELS.agent.getProviders) return sampleProviders;
      if (channel === IPC_CHANNELS.agent.getSettings) return sampleSettings;
      if (channel === IPC_CHANNELS.agent.getSnapshot)
        return sampleAgentSnapshot;
      throw new Error(`Unexpected channel ${channel}`);
    });
    const invokeContract = createContractInvoker(invoke);

    await expect(
      invokeContract(snapshotContracts.shell.getSnapshot),
    ).resolves.toMatchObject({ appName: "Pi Desktop" });
    await expect(
      invokeContract(snapshotContracts.agent.getProviders),
    ).resolves.toHaveLength(1);
    await expect(
      invokeContract(snapshotContracts.agent.getSettings),
    ).resolves.toMatchObject({ currentProviderId: "anthropic" });
    await expect(
      invokeContract(snapshotContracts.agent.getSnapshot),
    ).resolves.toMatchObject({ sessionId: "session-1" });

    expect(invoke.mock.calls).toEqual([
      [IPC_CHANNELS.shell.getSnapshot, undefined],
      [IPC_CHANNELS.agent.getProviders, undefined],
      [IPC_CHANNELS.agent.getSettings, undefined],
      [IPC_CHANNELS.agent.getSnapshot, undefined],
    ]);
  });

  it("rejects invoked responses that fail schema decoding", async () => {
    const invoke = vi.fn(async () => ({
      // missing every required ShellSnapshot field
      appName: "Pi Desktop",
    }));
    const invokeContract = createContractInvoker(invoke);

    await expect(
      invokeContract(snapshotContracts.shell.getSnapshot),
    ).rejects.toThrow();
  });

  it("registers handlers and decodes their responses through the contract", async () => {
    const registered = new Map<
      string,
      (event?: unknown, payload?: unknown) => Promise<unknown> | unknown
    >();
    const getShellSnapshot = vi.fn(async () => sampleShellSnapshot);
    const getProviders = vi.fn(async () => sampleProviders);
    const getSettings = vi.fn(async () => sampleSettings);
    const getAgentSnapshot = vi.fn(async () => sampleAgentSnapshot);

    registerContractHandlers({
      handle(channel, listener) {
        registered.set(channel, listener);
      },
      contracts: [
        {
          contract: snapshotContracts.shell.getSnapshot,
          handler: getShellSnapshot,
        },
        {
          contract: snapshotContracts.agent.getProviders,
          handler: getProviders,
        },
        {
          contract: snapshotContracts.agent.getSettings,
          handler: getSettings,
        },
        {
          contract: snapshotContracts.agent.getSnapshot,
          handler: getAgentSnapshot,
        },
      ],
    });

    await expect(
      registered.get(IPC_CHANNELS.shell.getSnapshot)?.(undefined, undefined),
    ).resolves.toMatchObject({ appName: "Pi Desktop" });
    await expect(
      registered.get(IPC_CHANNELS.agent.getProviders)?.(undefined, undefined),
    ).resolves.toHaveLength(1);
    await expect(
      registered.get(IPC_CHANNELS.agent.getSettings)?.(undefined, undefined),
    ).resolves.toMatchObject({ currentProviderId: "anthropic" });
    await expect(
      registered.get(IPC_CHANNELS.agent.getSnapshot)?.(undefined, undefined),
    ).resolves.toMatchObject({ sessionId: "session-1" });

    expect(getShellSnapshot).toHaveBeenCalledTimes(1);
    expect(getProviders).toHaveBeenCalledTimes(1);
    expect(getSettings).toHaveBeenCalledTimes(1);
    expect(getAgentSnapshot).toHaveBeenCalledTimes(1);
  });

  it("rejects a handler that returns a shape missing required fields", async () => {
    const registered = new Map<
      string,
      (event?: unknown, payload?: unknown) => Promise<unknown> | unknown
    >();

    registerContractHandler({
      handle(channel, listener) {
        registered.set(channel, listener);
      },
      contract: snapshotContracts.agent.getSnapshot,
      // missing `messages`, `lastError`
      handler: async () => ({ sessionId: "session-x", status: "ready" }),
    });

    const listener = registered.get(IPC_CHANNELS.agent.getSnapshot);
    expect(listener).toBeDefined();
    await expect(listener?.(undefined, undefined)).rejects.toThrow();
  });
});

describe("schema round-trips through the contract invoker", () => {
  it("decodes ShellSnapshot sample without loss", async () => {
    const invoke = vi.fn(async () => sampleShellSnapshot);
    const invokeContract = createContractInvoker(invoke);
    const decoded = await invokeContract(snapshotContracts.shell.getSnapshot);
    expect(decoded).toMatchObject({ appName: "Pi Desktop", mode: "test" });
  });

  it("decodes ProviderSnapshotArray sample", async () => {
    const invoke = vi.fn(async () => sampleProviders);
    const invokeContract = createContractInvoker(invoke);
    const decoded = await invokeContract(snapshotContracts.agent.getProviders);
    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toMatchObject({ id: "anthropic" });
  });

  it("decodes SettingsSnapshot sample", async () => {
    const invoke = vi.fn(async () => sampleSettings);
    const invokeContract = createContractInvoker(invoke);
    const decoded = await invokeContract(snapshotContracts.agent.getSettings);
    expect(decoded).toMatchObject({ currentProviderId: "anthropic" });
  });

  it("decodes AgentSnapshot sample", async () => {
    const invoke = vi.fn(async () => sampleAgentSnapshot);
    const invokeContract = createContractInvoker(invoke);
    const decoded = await invokeContract(snapshotContracts.agent.getSnapshot);
    expect(decoded).toMatchObject({ sessionId: "session-1", status: "ready" });
  });
});
