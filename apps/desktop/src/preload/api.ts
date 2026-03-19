import {
  type AgentSnapshot,
  type AppPreferences,
  type AutocompleteContext,
  type AutocompleteSuggestions,
  type CanvasWindow,
  type CreateWindowAction,
  type ImageMetadata,
  type ImagePreview,
  type ImagePreviewOptions,
  IPC_CHANNELS,
  type LegacyPreferencesImport,
  type ModelSwitchRequest,
  type PiDeskAgentEvent,
  type PiDeskApi,
  type PiDiscoveryResult,
  type PiTerminalRouteRequest,
  type PiTerminalRouteResult,
  type ProviderSnapshot,
  type RepositoryDisplayMetadata,
  type RepositoryPreferences,
  type SearchRequest,
  type SearchResponse,
  type SettingsSnapshot,
  type ShellSnapshot,
  type TerminalCreateOptions,
  type TerminalSession,
  type WindowLayoutState,
  type WindowPosition,
  type WorkspaceSession,
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
      switchModel(request: ModelSwitchRequest) {
        return invoke<void>(IPC_CHANNELS.agent.switchModel, request);
      },
      getDiscovery() {
        return invoke<PiDiscoveryResult>(
          IPC_CHANNELS.agent.getDiscovery,
          undefined,
        );
      },
      getSlashSuggestions(context: AutocompleteContext) {
        return invoke<AutocompleteSuggestions>(
          IPC_CHANNELS.agent.getSlashSuggestions,
          context,
        );
      },
      subscribe(listener: (event: PiDeskAgentEvent) => void) {
        return on<PiDeskAgentEvent>(IPC_CHANNELS.agent.event, listener);
      },
    },
    repositories: {
      add(path: string) {
        return invoke<void>(IPC_CHANNELS.repositories.add, { path });
      },
      select(repositoryId: string) {
        return invoke<void>(IPC_CHANNELS.repositories.select, { repositoryId });
      },
    },
    worktrees: {
      create(repositoryId: string, branchName: string) {
        return invoke<void>(IPC_CHANNELS.worktrees.create, {
          repositoryId,
          branchName,
        });
      },
      select(worktreeId: string) {
        return invoke<void>(IPC_CHANNELS.worktrees.select, { worktreeId });
      },
    },
    threads: {
      create(worktreeId: string, title?: string) {
        return invoke<void>(IPC_CHANNELS.threads.create, { worktreeId, title });
      },
      select(threadId: string) {
        return invoke<void>(IPC_CHANNELS.threads.select, { threadId });
      },
      archive(threadId: string) {
        return invoke<void>(IPC_CHANNELS.threads.archive, { threadId });
      },
      routeToTerminal(request: PiTerminalRouteRequest) {
        return invoke<PiTerminalRouteResult>(
          IPC_CHANNELS.threads.routeToTerminal,
          request,
        );
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
      writeFile(path: string, content: string) {
        return invoke<void>(IPC_CHANNELS.fs.writeFile, { path, content });
      },
      getImageMetadata(path: string) {
        return invoke<ImageMetadata>(IPC_CHANNELS.fs.getImageMetadata, {
          path,
        });
      },
      getImagePreview(path: string, options?: ImagePreviewOptions) {
        return invoke<ImagePreview>(IPC_CHANNELS.fs.getImagePreview, {
          path,
          options,
        });
      },
    },
    terminal: {
      create(options: TerminalCreateOptions) {
        return invoke<TerminalSession>(IPC_CHANNELS.terminal.create, options);
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
      getSessions() {
        return invoke<TerminalSession[]>(
          IPC_CHANNELS.terminal.getSessions,
          undefined,
        );
      },
      onEvent(
        listener: (event: {
          type: string;
          id: string;
          data?: string;
          exitCode?: number;
        }) => void,
      ) {
        return on(IPC_CHANNELS.terminal.create, listener);
      },
    },
    search: {
      searchFiles(request: SearchRequest) {
        return invoke<SearchResponse>(IPC_CHANNELS.search.searchFiles, request);
      },
    },
    state: {
      getRepositoryPreferences(repositoryId: string) {
        return invoke<RepositoryPreferences | null>(
          IPC_CHANNELS.state.getRepositoryPreferences,
          { repositoryId },
        );
      },
      updateRepositoryPreferences(
        repositoryId: string,
        updates: Partial<RepositoryDisplayMetadata>,
      ) {
        return invoke<RepositoryPreferences>(
          IPC_CHANNELS.state.updateRepositoryPreferences,
          { repositoryId, updates },
        );
      },
      getWorkspaceSession(worktreeId: string) {
        return invoke<WorkspaceSession | null>(
          IPC_CHANNELS.state.getWorkspaceSession,
          { worktreeId },
        );
      },
      saveWorkspaceSession(session: WorkspaceSession) {
        return invoke<WorkspaceSession>(
          IPC_CHANNELS.state.saveWorkspaceSession,
          {
            session,
          },
        );
      },
      getAppPreferences() {
        return invoke<AppPreferences>(
          IPC_CHANNELS.state.getAppPreferences,
          undefined,
        );
      },
      updateAppPreferences(updates: Partial<AppPreferences>) {
        return invoke<AppPreferences>(IPC_CHANNELS.state.updateAppPreferences, {
          updates,
        });
      },
      importLegacyPreferences(importData: LegacyPreferencesImport) {
        return invoke<{
          repositoryPreferences: RepositoryPreferences[];
          appPreferences: AppPreferences;
        }>(IPC_CHANNELS.state.importLegacyPreferences, {
          importData,
        });
      },
    },
    window: {
      create(action: CreateWindowAction) {
        return invoke<CanvasWindow>(IPC_CHANNELS.window.create, action);
      },
      close(windowId: string) {
        return invoke<void>(IPC_CHANNELS.window.close, { windowId });
      },
      focus(windowId: string) {
        return invoke<void>(IPC_CHANNELS.window.focus, { windowId });
      },
      move(windowId: string, position: WindowPosition) {
        return invoke<void>(IPC_CHANNELS.window.move, { windowId, position });
      },
      resize(windowId: string, position: WindowPosition) {
        return invoke<void>(IPC_CHANNELS.window.resize, { windowId, position });
      },
      minimize(windowId: string) {
        return invoke<void>(IPC_CHANNELS.window.minimize, { windowId });
      },
      maximize(windowId: string) {
        return invoke<void>(IPC_CHANNELS.window.maximize, { windowId });
      },
      restore(windowId: string) {
        return invoke<void>(IPC_CHANNELS.window.restore, { windowId });
      },
      getLayout() {
        return invoke<WindowLayoutState>(
          IPC_CHANNELS.window.getLayout,
          undefined,
        );
      },
    },
  };
}
