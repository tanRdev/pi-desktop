import {
  agentContracts,
  clipboardContracts,
  createContractInvoker,
  createContractSubscriber,
  dialogContracts,
  fsContracts,
  gitContracts,
  packagesContracts,
  repositoryContracts,
  searchContracts,
  snapshotContracts,
  terminalContracts,
  threadContracts,
  windowContracts,
  worktreeContracts,
} from "@pi-desktop/contracts";
import type {
  ModelSwitchRequest,
  OAuthPromptResponse,
  OpenDialogOptions,
  PackageInstallRequest,
  PackageRemoveRequest,
  PackageSearchRequest,
  PackageUpdateRequest,
  PiDesktopAgentEvent,
  PiDesktopApi,
  SearchRequest,
  TerminalCreateOptions,
} from "@pi-desktop/shared";

import { createFsWatch } from "./fs-watch-api";
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
  const subscribeContract = createContractSubscriber(on);

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
        return invokeContract(agentContracts.getOAuthProviders);
      },
      loginWithOAuth(providerId: string) {
        return invokeContract(agentContracts.loginWithOAuth, { providerId });
      },
      logoutOAuth(providerId: string) {
        return invokeContract(agentContracts.logoutOAuth, { providerId });
      },
      onOAuthPrompt(listener) {
        return subscribeContract(agentContracts.oauthPrompt, listener);
      },
      respondOAuthPrompt(response: OAuthPromptResponse) {
        return invokeContract(agentContracts.respondOAuthPrompt, response);
      },
      prompt(text: string) {
        return invokeContract(agentContracts.prompt, { text });
      },
      cancelPrompt() {
        return invokeContract(agentContracts.cancelPrompt);
      },
      reset() {
        return invokeContract(agentContracts.reset);
      },
      switchModel(request: ModelSwitchRequest) {
        return invokeContract(agentContracts.switchModel, request);
      },
      getDiscovery() {
        return invokeContract(agentContracts.getDiscovery);
      },
      getSlashSuggestions(context) {
        return invokeContract(agentContracts.getSlashSuggestions, context);
      },
      subscribe(listener: (event: PiDesktopAgentEvent) => void) {
        return subscribeContract(agentContracts.event, listener);
      },
    },
    repositories: {
      add(path: string) {
        return invokeContract(repositoryContracts.add, { path });
      },
      reorder(repositoryIds: string[]) {
        return invokeContract(repositoryContracts.reorder, { repositoryIds });
      },
      select(repositoryId: string) {
        return invokeContract(repositoryContracts.select, { repositoryId });
      },
      remove(repositoryId: string) {
        return invokeContract(repositoryContracts.remove, { repositoryId });
      },
      openInFinder(repositoryId: string) {
        return invokeContract(repositoryContracts.openInFinder, {
          repositoryId,
        });
      },
    },
    worktrees: {
      create(repositoryId: string, branchName: string) {
        return invokeContract(worktreeContracts.create, {
          repositoryId,
          branchName,
        });
      },
      select(worktreeId: string) {
        return invokeContract(worktreeContracts.select, { worktreeId });
      },
      remove(worktreeId: string) {
        return invokeContract(worktreeContracts.remove, { worktreeId });
      },
    },
    threads: {
      create(worktreeId: string) {
        return invokeContract(threadContracts.create, { worktreeId });
      },
      select(threadId: string) {
        return invokeContract(threadContracts.select, { threadId });
      },
      delete(threadId: string) {
        return invokeContract(threadContracts.delete, { threadId });
      },
    },
    dialog: {
      showOpenDialog(options: OpenDialogOptions) {
        return invokeContract(
          dialogContracts.showOpenDialog,
          options,
        ) as Promise<string[] | null>;
      },
      openExternal(url: string) {
        return invokeContract(dialogContracts.openExternal, { url });
      },
    },
    fs: {
      readDirectory(path: string) {
        return invokeContract(fsContracts.readDirectory, { path }) as Promise<
          import("@pi-desktop/shared").DirectoryListing
        >;
      },
      readFile(path: string) {
        return invokeContract(fsContracts.readFile, { path });
      },
      writeFile(path: string, content: string) {
        return invokeContract(fsContracts.writeFile, { path, content });
      },
      deleteFile(path: string) {
        return invokeContract(fsContracts.deleteFile, { path });
      },
      renameFile(oldPath: string, newPath: string) {
        return invokeContract(fsContracts.renameFile, { oldPath, newPath });
      },
      moveFile(sourcePath: string, destinationPath: string) {
        return invokeContract(fsContracts.moveFile, {
          sourcePath,
          destinationPath,
        });
      },
      watch: createFsWatch({ invoke, on }),
    },
    git: {
      getRepositoryStatus(
        repositoryPath: string,
        options?: { force?: boolean },
      ) {
        return invokeContract(gitContracts.getRepositoryStatus, {
          repositoryPath,
          ...(options?.force ? { force: true } : {}),
        });
      },
      isRepository(targetPath: string) {
        return invokeContract(gitContracts.isRepository, {
          repositoryPath: targetPath,
        });
      },
      init(targetPath: string) {
        return invokeContract(gitContracts.init, {
          repositoryPath: targetPath,
        });
      },
      diffFile(repositoryPath: string, filePath: string, staged: boolean) {
        return invokeContract(gitContracts.diffFile, {
          repositoryPath,
          filePath,
          staged,
        });
      },
      stageFile(repositoryPath: string, filePath: string) {
        return invokeContract(gitContracts.stageFile, {
          repositoryPath,
          filePath,
        });
      },
      stageFiles(repositoryPath: string, filePaths: string[]) {
        return invokeContract(gitContracts.stageFiles, {
          repositoryPath,
          filePaths,
        });
      },
      unstageFile(repositoryPath: string, filePath: string) {
        return invokeContract(gitContracts.unstageFile, {
          repositoryPath,
          filePath,
        });
      },
      unstageFiles(repositoryPath: string, filePaths: string[]) {
        return invokeContract(gitContracts.unstageFiles, {
          repositoryPath,
          filePaths,
        });
      },
      discardFile(repositoryPath: string, filePath: string) {
        return invokeContract(gitContracts.discardFile, {
          repositoryPath,
          filePath,
        });
      },
      commit(repositoryPath: string, message: string) {
        return invokeContract(gitContracts.commit, {
          repositoryPath,
          message,
        });
      },
      fetch(repositoryPath: string) {
        return invokeContract(gitContracts.fetch, { repositoryPath });
      },
      pull(repositoryPath: string) {
        return invokeContract(gitContracts.pull, { repositoryPath });
      },
      push(repositoryPath: string) {
        return invokeContract(gitContracts.push, { repositoryPath });
      },
    },
    packages: {
      getManagerStatus() {
        return invokeContract(packagesContracts.getManagerStatus);
      },
      searchCatalog(request: PackageSearchRequest) {
        return invokeContract(packagesContracts.searchCatalog, request);
      },
      getPackageDetail(packageName: string) {
        return invokeContract(packagesContracts.getPackageDetail, {
          packageName,
        });
      },
      listInstalled(scope?: "global" | "local") {
        return invokeContract(packagesContracts.listInstalled, { scope });
      },
      install(request: PackageInstallRequest) {
        return invokeContract(packagesContracts.install, request);
      },
      remove(request: PackageRemoveRequest) {
        return invokeContract(packagesContracts.remove, request);
      },
      update(request: PackageUpdateRequest) {
        return invokeContract(packagesContracts.update, request);
      },
      subscribe(listener) {
        return subscribeContract(packagesContracts.event, listener);
      },
    },
    terminal: {
      create(options: TerminalCreateOptions) {
        return invokeContract(
          terminalContracts.create as never,
          options as never,
        ) as Promise<import("@pi-desktop/shared").TerminalSession>;
      },
      write(id: string, data: string) {
        return invokeContract(terminalContracts.write, { id, data });
      },
      resize(id: string, cols: number, rows: number) {
        return invokeContract(terminalContracts.resize, { id, cols, rows });
      },
      destroy(id: string) {
        return invokeContract(terminalContracts.destroy, { id });
      },
      getSessions() {
        return invokeContract(terminalContracts.getSessions);
      },
      onEvent(listener) {
        return subscribeContract(terminalContracts.event, listener);
      },
    },
    search: {
      searchFiles(request: SearchRequest) {
        return invokeContract(searchContracts.searchFiles, request);
      },
    },
    state: createStateApi({ invoke }),
    window: {
      getFullscreenState() {
        return invokeContract(windowContracts.getFullscreenState);
      },
      onFullscreenChanged(listener: (isFullscreen: boolean) => void) {
        return subscribeContract(windowContracts.fullscreenChanged, listener);
      },
    },
    clipboard: {
      writeText(text: string) {
        return invokeContract(clipboardContracts.writeText, { text });
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
