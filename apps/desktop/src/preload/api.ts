import {
  type AgentSnapshot,
  type AppPreferences,
  type AutocompleteContext,
  type AutocompleteSuggestions,
  type GitFileDiff,
  type GitRepositoryStatus,
  IPC_CHANNELS,
  type LegacyPreferencesImport,
  type ModelSwitchRequest,
  type OAuthProviderSnapshot,
  type PackageInstallRequest,
  type PackageManagerStatus,
  type PackageOperationSnapshot,
  type PackageRemoveRequest,
  type PackageSearchRequest,
  type PackageSearchResponse,
  type PackagesEvent,
  type PackageUpdateRequest,
  type PiDesktopAgentEvent,
  type PiDesktopApi,
  type PiDiscoveryResult,
  type ProviderSnapshot,
  type RepositoryDisplayMetadata,
  type RepositoryPreferences,
  type SearchRequest,
  type SearchResponse,
  type SettingsSnapshot,
  type ShellSnapshot,
  type TerminalCreateOptions,
  type TerminalSession,
  type WorkspaceSession,
} from "@pi-desktop/shared";

const OPEN_EXTERNAL_CHANNEL =
  IPC_CHANNELS.dialog.openExternal ?? "dialog:openExternal";

export type PreloadInvoke = <TReturn>(
  channel: string,
  payload?: unknown,
) => Promise<TReturn>;

export type PreloadOn = <TPayload>(
  channel: string,
  listener: (payload: TPayload) => void,
) => () => void;

export interface CreatePiDesktopApiDependencies {
  invoke: PreloadInvoke;
  on: PreloadOn;
}

// TODO(A6): once shared exposes UpdaterState + IPC_CHANNELS.updates, replace
// these locally-mirrored types with the canonical shared ones and add
// `updates` to the PiDesktopApi interface.
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

export type PiDesktopApiWithUpdates = PiDesktopApi & {
  updates: UpdatesApi;
};

// Channel constants mirror apps/desktop/src/main/auto-updater.ts UPDATE_IPC_CHANNELS.
// TODO(A6): consume IPC_CHANNELS.updates.* once shared exports them.
const UPDATE_IPC_CHANNELS = {
  event: "updates:event",
  getState: "updates:getState",
  check: "updates:check",
  download: "updates:download",
  install: "updates:install",
} as const;

export function createPiDesktopApi({
  invoke,
  on,
}: CreatePiDesktopApiDependencies): PiDesktopApiWithUpdates {
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
      getOAuthProviders() {
        return invoke<OAuthProviderSnapshot[]>(
          IPC_CHANNELS.agent.getOAuthProviders,
          undefined,
        );
      },
      loginWithOAuth(providerId: string) {
        return invoke<void>(IPC_CHANNELS.agent.loginWithOAuth, { providerId });
      },
      logoutOAuth(providerId: string) {
        return invoke<void>(IPC_CHANNELS.agent.logoutOAuth, { providerId });
      },
      prompt(text: string) {
        return invoke<void>(IPC_CHANNELS.agent.prompt, { text });
      },
      cancelPrompt() {
        return invoke<void>(IPC_CHANNELS.agent.cancelPrompt, undefined);
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
      subscribe(listener: (event: PiDesktopAgentEvent) => void) {
        return on<PiDesktopAgentEvent>(IPC_CHANNELS.agent.event, listener);
      },
    },
    repositories: {
      add(path: string) {
        return invoke<void>(IPC_CHANNELS.repositories.add, { path });
      },
      reorder(repositoryIds: string[]) {
        return invoke<void>(IPC_CHANNELS.repositories.reorder, {
          repositoryIds,
        });
      },
      select(repositoryId: string) {
        return invoke<void>(IPC_CHANNELS.repositories.select, { repositoryId });
      },
      remove(repositoryId: string) {
        return invoke<void>(IPC_CHANNELS.repositories.remove, { repositoryId });
      },
      openInFinder(repositoryId: string) {
        return invoke<void>(IPC_CHANNELS.repositories.openInFinder, {
          repositoryId,
        });
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
      remove(worktreeId: string) {
        return invoke<void>(IPC_CHANNELS.worktrees.remove, { worktreeId });
      },
    },
    threads: {
      create(worktreeId: string) {
        return invoke<string>(IPC_CHANNELS.threads.create, { worktreeId });
      },
      select(threadId: string) {
        return invoke<void>(IPC_CHANNELS.threads.select, { threadId });
      },
      delete(threadId: string) {
        return invoke<void>(IPC_CHANNELS.threads.delete, { threadId });
      },
    },
    dialog: {
      showOpenDialog(options: Electron.OpenDialogOptions) {
        return invoke<string[] | null>(
          IPC_CHANNELS.dialog.showOpenDialog,
          options,
        );
      },
      openExternal(url: string) {
        return invoke<void>(OPEN_EXTERNAL_CHANNEL, { url });
      },
    },
    fs: {
      readDirectory(path: string) {
        return invoke<import("@pi-desktop/shared").DirectoryListing>(
          IPC_CHANNELS.fs.readDirectory,
          { path },
        );
      },
      readFile(path: string) {
        return invoke<import("@pi-desktop/shared").FileContent>(
          IPC_CHANNELS.fs.readFile,
          { path },
        );
      },
      writeFile(path: string, content: string) {
        return invoke<void>(IPC_CHANNELS.fs.writeFile, { path, content });
      },
      deleteFile(path: string) {
        return invoke<void>(IPC_CHANNELS.fs.deleteFile, { path });
      },
      renameFile(oldPath: string, newPath: string) {
        return invoke<void>(IPC_CHANNELS.fs.renameFile, { oldPath, newPath });
      },
      moveFile(sourcePath: string, destinationPath: string) {
        return invoke<void>(IPC_CHANNELS.fs.moveFile, {
          sourcePath,
          destinationPath,
        });
      },
    },
    git: {
      getRepositoryStatus(repositoryPath: string) {
        return invoke<GitRepositoryStatus>(
          IPC_CHANNELS.git.getRepositoryStatus,
          {
            repositoryPath,
          },
        );
      },
      isRepository(targetPath: string) {
        return invoke<boolean>(IPC_CHANNELS.git.isRepository, {
          repositoryPath: targetPath,
        });
      },
      init(targetPath: string) {
        return invoke<void>(IPC_CHANNELS.git.init, {
          repositoryPath: targetPath,
        });
      },
      diffFile(repositoryPath: string, filePath: string, staged: boolean) {
        return invoke<GitFileDiff>(IPC_CHANNELS.git.diffFile, {
          repositoryPath,
          filePath,
          staged,
        });
      },
      stageFile(repositoryPath: string, filePath: string) {
        return invoke<GitRepositoryStatus>(IPC_CHANNELS.git.stageFile, {
          repositoryPath,
          filePath,
        });
      },
      stageFiles(repositoryPath: string, filePaths: string[]) {
        return invoke<GitRepositoryStatus>(IPC_CHANNELS.git.stageFiles, {
          repositoryPath,
          filePaths,
        });
      },
      unstageFile(repositoryPath: string, filePath: string) {
        return invoke<GitRepositoryStatus>(IPC_CHANNELS.git.unstageFile, {
          repositoryPath,
          filePath,
        });
      },
      unstageFiles(repositoryPath: string, filePaths: string[]) {
        return invoke<GitRepositoryStatus>(IPC_CHANNELS.git.unstageFiles, {
          repositoryPath,
          filePaths,
        });
      },
      discardFile(repositoryPath: string, filePath: string) {
        return invoke<GitRepositoryStatus>(IPC_CHANNELS.git.discardFile, {
          repositoryPath,
          filePath,
        });
      },
      commit(repositoryPath: string, message: string) {
        return invoke<GitRepositoryStatus>(IPC_CHANNELS.git.commit, {
          repositoryPath,
          message,
        });
      },
      fetch(repositoryPath: string) {
        return invoke<GitRepositoryStatus>(IPC_CHANNELS.git.fetch, {
          repositoryPath,
        });
      },
      pull(repositoryPath: string) {
        return invoke<GitRepositoryStatus>(IPC_CHANNELS.git.pull, {
          repositoryPath,
        });
      },
      push(repositoryPath: string) {
        return invoke<GitRepositoryStatus>(IPC_CHANNELS.git.push, {
          repositoryPath,
        });
      },
    },
    packages: {
      getManagerStatus() {
        return invoke<PackageManagerStatus>(
          IPC_CHANNELS.packages.getManagerStatus,
          undefined,
        );
      },
      searchCatalog(request: PackageSearchRequest) {
        return invoke<PackageSearchResponse>(
          IPC_CHANNELS.packages.searchCatalog,
          request,
        );
      },
      getPackageDetail(packageName: string) {
        return invoke<import("@pi-desktop/shared").PackageCatalogDetail>(
          IPC_CHANNELS.packages.getPackageDetail,
          { packageName },
        );
      },
      listInstalled(scope?: "global" | "local") {
        return invoke<import("@pi-desktop/shared").InstalledPackageSnapshot[]>(
          IPC_CHANNELS.packages.listInstalled,
          { scope },
        );
      },
      install(request: PackageInstallRequest) {
        return invoke<PackageOperationSnapshot>(
          IPC_CHANNELS.packages.install,
          request,
        );
      },
      remove(request: PackageRemoveRequest) {
        return invoke<PackageOperationSnapshot>(
          IPC_CHANNELS.packages.remove,
          request,
        );
      },
      update(request: PackageUpdateRequest) {
        return invoke<PackageOperationSnapshot>(
          IPC_CHANNELS.packages.update,
          request,
        );
      },
      subscribe(listener: (event: PackagesEvent) => void) {
        return on<PackagesEvent>(IPC_CHANNELS.packages.event, listener);
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
        return on(IPC_CHANNELS.terminal.event, listener);
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
      getFullscreenState() {
        return invoke<boolean>(
          IPC_CHANNELS.window.getFullscreenState,
          undefined,
        );
      },
      onFullscreenChanged(listener: (isFullscreen: boolean) => void) {
        return on<boolean>(IPC_CHANNELS.window.fullscreenChanged, listener);
      },
    },
    updates: {
      getState() {
        return invoke<UpdaterState>(UPDATE_IPC_CHANNELS.getState, undefined);
      },
      check() {
        return invoke<UpdaterState>(UPDATE_IPC_CHANNELS.check, undefined);
      },
      download() {
        return invoke<UpdaterState>(UPDATE_IPC_CHANNELS.download, undefined);
      },
      install() {
        void invoke<UpdaterState>(UPDATE_IPC_CHANNELS.install, undefined);
      },
      subscribe(listener: (state: UpdaterState) => void) {
        return on<UpdaterState>(UPDATE_IPC_CHANNELS.event, listener);
      },
    },
  };
}
