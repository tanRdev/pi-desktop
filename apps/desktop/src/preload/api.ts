import {
  type AgentSnapshot,
  IPC_CHANNELS,
  type PiDeskAgentEvent,
  type PiDeskApi,
  type ShellSnapshot,
} from "@pidesk/shared";

export type PreloadInvoke = <TReturn>(
  channel: string,
  payload?: unknown,
) => Promise<TReturn>;

export type PreloadOn = <TPayload>(
  channel: string,
  listener: (payload: TPayload) => void,
) => () => void;

export interface CreatePiDeskApiDependencies {
  invoke: PreloadInvoke;
  on: PreloadOn;
}

export function createPiDeskApi({
  invoke,
  on,
}: CreatePiDeskApiDependencies): PiDeskApi {
  return {
    shell: {
      getSnapshot() {
        return invoke<ShellSnapshot>(IPC_CHANNELS.shell.getSnapshot, undefined);
      },
    },
    agent: {
      getSnapshot() {
        return invoke<AgentSnapshot>(IPC_CHANNELS.agent.getSnapshot, undefined);
      },
      prompt(text) {
        return invoke<void>(IPC_CHANNELS.agent.prompt, { text });
      },
      reset() {
        return invoke<void>(IPC_CHANNELS.agent.reset, undefined);
      },
      subscribe(listener) {
        return on<PiDeskAgentEvent>(IPC_CHANNELS.agent.event, listener);
      },
    },
  };
}
