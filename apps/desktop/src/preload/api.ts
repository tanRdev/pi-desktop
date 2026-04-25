import {
  createContractInvoker,
  snapshotContracts,
} from "@pi-desktop/contracts";
import {
  type AutocompleteContext,
  type AutocompleteSuggestions,
  type GitFileDiff,
  type GitRepositoryStatus,
  IPC_CHANNELS,
  type ModelSwitchRequest,
  type OAuthProviderSnapshot,
  type OpenDialogOptions,
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
  type SearchRequest,
  type SearchResponse,
  type TerminalCreateOptions,
  type TerminalSession,
} from "@pi-desktop/shared";

import { createStateApi } from "./state-api";
import {
  createUpdatesApi,
  type PreloadInvoke,
  type PreloadOn,
  type UpdateInfoSnapshot,
  type UpdaterErrorInfo,
  type UpdaterState,
  type UpdaterStatus,
  type UpdatesApi,
} from "./updates-api";

const OPEN_EXTERNAL_CHANNEL =
  IPC_CHANNELS.dialog.openExternal ?? "dialog:openExternal";

export interface CreatePiDesktopApiDependencies {
  invoke: PreloadInvoke;
  on: PreloadOn;
}

export type PiDesktopApiWithUpdates = PiDesktopApi & {
  updates: UpdatesApi;
};

export function createPiDesktopApi({
  invoke,
  on,
}: CreatePiDesktopApiDependencies): PiDesktopApiWithUpdates {
  const invokeContract = createContractInvoker(invoke);

  return {
    shell: {
      getSnapshot() {
        return invokeContract(snapshotContracts.shell.getSnapshot);
      },
    },
    agent: {
      getProviders() {
        return invokeContract(snapshotContracts.agent.getProviders);
      },
      getSettings() {
        return invokeContract(snapshotContracts.agent.getSettings);
      },
      getSnapshot() {
        return invokeContract(snapshotContracts.agent.getSnapshot);
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
      showOpenDialog(options: OpenDialogOptions) {
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
      getRepositoryStatus(
        repositoryPath: string,
        options?: { force?: boolean },
      ) {
        return invoke<GitRepositoryStatus>(
          IPC_CHANNELS.git.getRepositoryStatus,
          {
            repositoryPath,
            ...(options?.force ? { force: true } : {}),
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
    state: createStateApi({ invoke }),
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
    clipboard: {
      writeText(text: string) {
        return invoke<void>(IPC_CHANNELS.clipboard.writeText, { text });
      },
    },
    updates: createUpdatesApi({ invoke, on }),
  };
}

export type {
  PreloadInvoke,
  PreloadOn,
  UpdatesApi,
  UpdaterErrorInfo,
  UpdateInfoSnapshot,
  UpdaterState,
  UpdaterStatus,
};
