import {
  type AgentSnapshot,
  IPC_CHANNELS,
  type ShellSnapshot,
} from "@pidesk/shared";

export interface AgentIpcHost {
  getSnapshot(): Promise<AgentSnapshot>;
  prompt(text: string): Promise<void>;
  reset(): Promise<void>;
}

export interface IpcRegistrar {
  handle(
    channel: string,
    listener: (
      event?: unknown,
      payload?: unknown,
    ) => Promise<unknown> | unknown,
  ): void;
}

export interface RegisterIpcHandlersDependencies {
  handle: IpcRegistrar["handle"];
  getShellSnapshot(): ShellSnapshot;
  agentHost: AgentIpcHost;
}

export function registerIpcHandlers({
  handle,
  getShellSnapshot,
  agentHost,
}: RegisterIpcHandlersDependencies): void {
  handle(IPC_CHANNELS.shell.getSnapshot, async () => getShellSnapshot());
  handle(IPC_CHANNELS.agent.getSnapshot, async () => agentHost.getSnapshot());
  handle(IPC_CHANNELS.agent.prompt, async (_event, payload) => {
    const text =
      typeof payload === "object" && payload !== null && "text" in payload
        ? payload.text
        : undefined;

    if (typeof text !== "string" || text.length === 0) {
      throw new Error("Agent prompt payload must include text");
    }

    await agentHost.prompt(text);
  });
  handle(IPC_CHANNELS.agent.reset, async () => {
    await agentHost.reset();
  });
}
