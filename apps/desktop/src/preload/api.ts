import {
  type AgentSnapshot,
  IPC_CHANNELS,
  type PiDeskAgentEvent,
  type PiDeskApi,
  type ProviderSnapshot,
  type SettingsSnapshot,
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
      getProviders() {
        return invoke<ProviderSnapshot[]>(
          IPC_CHANNELS.agent.getProviders,
          undefined,
        );
      },
      getSettings() {
        return invoke<SettingsSnapshot>(
          IPC_CHANNELS.agent.getSettings,
          undefined,
        );
      },
      getSnapshot() {
        return invoke<AgentSnapshot>(IPC_CHANNELS.agent.getSnapshot, undefined);
      },
      prompt(text: string) {
        return invoke<void>(IPC_CHANNELS.agent.prompt, { text });
      },
      reset() {
        return invoke<void>(IPC_CHANNELS.agent.reset, undefined);
      },
      switchWorkspace(path: string) {
        return invoke<void>(IPC_CHANNELS.agent.switchWorkspace, { path });
      },
      subscribe(listener: (event: PiDeskAgentEvent) => void) {
        return on<PiDeskAgentEvent>(IPC_CHANNELS.agent.event, listener);
      },
    },
    dialog: {
      showOpenDialog(options: Electron.OpenDialogOptions) {
        return invoke<string[] | null>(
          IPC_CHANNELS.dialog.showOpenDialog,
          options,
        );
      },
    },
    fs: {
      readDirectory(path: string) {
        return invoke<import("@pidesk/shared").DirectoryListing>(
          IPC_CHANNELS.fs.readDirectory,
          { path },
        );
      },
      readFile(path: string) {
        return invoke<import("@pidesk/shared").FileContent>(
          IPC_CHANNELS.fs.readFile,
          { path },
        );
      },
    },
    terminal: {
      create(id: string, options: { cols: number; rows: number; cwd?: string }) {
        return invoke<void>(IPC_CHANNELS.terminal.create, { id, ...options });
      },
      write(id: string, data: string) {
        return invoke<void>(IPC_CHANNELS.terminal.write, { id, data });
      },
      resize(id: string, cols: number, rows: number) {
        return invoke<void>(IPC_CHANNELS.terminal.resize, { id, cols, rows });
      },
      destroy(id: string) {
        return invoke<void>(IPC_CHANNELS.terminal.destroy, { id });
      },
      onEvent(listener: (event: { type: string; id: string; data?: string; exitCode?: number }) => void) {
        return on(IPC_CHANNELS.terminal.create, listener);
      },
    },
  };
}
