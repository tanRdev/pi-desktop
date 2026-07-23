import {
  agentContracts,
  clipboardContracts,
  packagesContracts,
  registerContractHandler,
  searchContracts,
  snapshotContracts,
  windowContracts,
} from "@pi-desktop/contracts";
import type {
  AgentSnapshot,
  AutocompleteContext,
  AutocompleteSuggestions,
  ModelSwitchRequest,
  OAuthProviderSnapshot,
  PiDiscoveryResult,
  ProviderSnapshot,
  SearchRequest,
  SearchResponse,
  SettingsSnapshot,
  ShellSnapshot,
} from "@pi-desktop/shared";
import { type BrowserWindow, clipboard } from "electron";
import type { ThreadCatalog } from "./catalogs/thread-catalog";
import type { GitWorktreeService } from "./git-worktree-service";
import { registerDialogHandlers } from "./ipc/register-dialog-handlers";
import { registerFilesystemHandlers } from "./ipc/register-filesystem-handlers";
import { registerGitHandlers } from "./ipc/register-git-handlers";
import { registerRepositoryHandlers } from "./ipc/register-repository-handlers";
import {
  registerStateHandlers,
  type StateIpcHost,
} from "./ipc/register-state-handlers";
import { registerTerminalHandlers } from "./ipc/register-terminal-handlers";
import { registerThreadHandlers } from "./ipc/register-thread-handlers";
import type { PackagesService } from "./packages/packages-service";
import { terminalManager } from "./terminal-manager";

export interface AgentIpcHost {
  getProviders(): Promise<ProviderSnapshot[]>;
  getSettings(): Promise<SettingsSnapshot>;
  getSnapshot(): Promise<AgentSnapshot>;
  prompt(text: string): Promise<void>;
  cancelPrompt(): Promise<void>;
  reset(): Promise<void>;
  addRepository(path: string): Promise<void>;
  reorderRepositories(repositoryIds: string[]): Promise<void>;
  selectRepository(repositoryId: string): Promise<void>;
  removeRepository(repositoryId: string): Promise<void>;
  openRepositoryInFinder(repositoryId: string): Promise<void>;
  createWorktree(repositoryId: string, branchName: string): Promise<void>;
  selectWorktree(worktreeId: string): Promise<void>;
  removeWorktree(worktreeId: string): Promise<void>;
  createThread(worktreeId: string): Promise<string>;
  selectThread(threadId: string): Promise<void>;
  deleteThread(threadId: string): Promise<void>;
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
  getShellSnapshot(): Promise<ShellSnapshot> | ShellSnapshot;
  getWorkspaceRootPath?(): string | null;
  agentHost: AgentIpcHost;
  stateHost?: StateIpcHost;
  mainWindow: BrowserWindow | null;
  terminalManager?: typeof terminalManager;
  gitService?: GitWorktreeService;
  searchFiles?(request: SearchRequest): Promise<SearchResponse>;
  switchModel?(request: ModelSwitchRequest): Promise<void>;
  getOAuthProviders?(): Promise<OAuthProviderSnapshot[]>;
  loginWithOAuth?(providerId: string): Promise<void>;
  logoutOAuth?(providerId: string): Promise<void>;
  getDiscovery?(): Promise<PiDiscoveryResult>;
  getSlashSuggestions?(
    context: AutocompleteContext,
  ): Promise<AutocompleteSuggestions>;
  threadCatalog?: ThreadCatalog;
  packagesService?: PackagesService;
  getAllowedRepositoryRoots?: () => readonly string[];
  getAllowedTerminalCwds?: () => readonly string[];
}

export function registerIpcHandlers({
  handle,
  getShellSnapshot,
  getWorkspaceRootPath,
  agentHost,
  stateHost,
  mainWindow,
  terminalManager: terminalManagerOverride,
  gitService,
  searchFiles,
  switchModel,
  getOAuthProviders,
  loginWithOAuth,
  logoutOAuth,
  getDiscovery,
  getSlashSuggestions,
  packagesService,
  getAllowedRepositoryRoots,
  getAllowedTerminalCwds,
}: RegisterIpcHandlersDependencies): void {
  const tm = terminalManagerOverride ?? terminalManager;

  registerTerminalHandlers({
    handle,
    mainWindow,
    terminalManager: tm,
    getAllowedTerminalCwds: getAllowedTerminalCwds ?? (() => []),
  });
  registerRepositoryHandlers({ handle, agentHost });
  registerThreadHandlers({ handle, agentHost });
  registerDialogHandlers({ handle });
  registerFilesystemHandlers({
    handle,
    getWorkspaceRootPath: () => getWorkspaceRootPath?.() ?? null,
  });
  registerStateHandlers({ handle, stateHost });
  if (gitService) {
    registerGitHandlers({
      handle,
      gitService,
      getAllowedRepositoryRoots: getAllowedRepositoryRoots ?? (() => []),
    });
  }

  registerContractHandler({
    handle,
    contract: packagesContracts.getManagerStatus,
    handler: async () => {
      if (!packagesService) {
        throw new Error("Packages service is unavailable");
      }

      return packagesService.getManagerStatus();
    },
  });

  registerContractHandler({
    handle,
    contract: packagesContracts.searchCatalog,
    handler: async (request) => {
      if (!packagesService) {
        throw new Error("Packages service is unavailable");
      }

      return packagesService.searchCatalog(request);
    },
  });

  registerContractHandler({
    handle,
    contract: packagesContracts.getPackageDetail,
    handler: async ({ packageName }) => {
      if (!packagesService) {
        throw new Error("Packages service is unavailable");
      }

      return packagesService.getPackageDetail(packageName);
    },
  });

  registerContractHandler({
    handle,
    contract: packagesContracts.listInstalled,
    handler: async ({ scope }) => {
      if (!packagesService) {
        throw new Error("Packages service is unavailable");
      }

      return packagesService.listInstalled(scope);
    },
  });

  registerContractHandler({
    handle,
    contract: packagesContracts.install,
    handler: async (request) => {
      if (!packagesService) {
        throw new Error("Packages service is unavailable");
      }

      return packagesService.install(request);
    },
  });

  registerContractHandler({
    handle,
    contract: packagesContracts.remove,
    handler: async (request) => {
      if (!packagesService) {
        throw new Error("Packages service is unavailable");
      }

      return packagesService.remove(request);
    },
  });

  registerContractHandler({
    handle,
    contract: packagesContracts.update,
    handler: async (request) => {
      if (!packagesService) {
        throw new Error("Packages service is unavailable");
      }

      return packagesService.update(request);
    },
  });

  registerContractHandler({
    handle,
    contract: snapshotContracts.shell.getSnapshot,
    handler: () => getShellSnapshot(),
  });
  registerContractHandler({
    handle,
    contract: snapshotContracts.agent.getProviders,
    handler: () => agentHost.getProviders(),
  });
  registerContractHandler({
    handle,
    contract: snapshotContracts.agent.getSettings,
    handler: () => agentHost.getSettings(),
  });
  registerContractHandler({
    handle,
    contract: snapshotContracts.agent.getSnapshot,
    handler: () => agentHost.getSnapshot(),
  });

  registerContractHandler({
    handle,
    contract: agentContracts.switchModel,
    handler: async (request) => {
      if (!switchModel) {
        throw new Error("Model switching is unavailable");
      }

      await switchModel(request);
    },
  });

  registerContractHandler({
    handle,
    contract: agentContracts.getDiscovery,
    handler: async () =>
      getDiscovery
        ? getDiscovery()
        : { isInstalled: false, skills: [], commands: [] },
  });

  registerContractHandler({
    handle,
    contract: agentContracts.getOAuthProviders,
    handler: async () => (getOAuthProviders ? getOAuthProviders() : []),
  });

  registerContractHandler({
    handle,
    contract: agentContracts.loginWithOAuth,
    handler: async ({ providerId }) => {
      if (!loginWithOAuth) {
        throw new Error("OAuth login is unavailable");
      }

      await loginWithOAuth(providerId);
    },
  });

  registerContractHandler({
    handle,
    contract: agentContracts.logoutOAuth,
    handler: async ({ providerId }) => {
      if (!logoutOAuth) {
        throw new Error("OAuth logout is unavailable");
      }

      await logoutOAuth(providerId);
    },
  });

  registerContractHandler({
    handle,
    contract: agentContracts.getSlashSuggestions,
    handler: async (context) => {
      if (!getSlashSuggestions) {
        return {
          kind: "slash",
          suggestions: [],
          hasMore: false,
        } satisfies AutocompleteSuggestions;
      }

      return getSlashSuggestions(context);
    },
  });

  registerContractHandler({
    handle,
    contract: agentContracts.prompt,
    handler: async ({ text }) => {
      await agentHost.prompt(text);
    },
  });

  registerContractHandler({
    handle,
    contract: agentContracts.cancelPrompt,
    handler: async () => {
      await agentHost.cancelPrompt();
    },
  });

  registerContractHandler({
    handle,
    contract: agentContracts.reset,
    handler: async () => {
      await agentHost.reset();
    },
  });

  registerContractHandler({
    handle,
    contract: searchContracts.searchFiles,
    handler: async (request) => {
      if (!searchFiles) {
        throw new Error("File search is unavailable");
      }
      return searchFiles(request);
    },
  });

  registerContractHandler({
    handle,
    contract: windowContracts.getFullscreenState,
    handler: async () => mainWindow?.isFullScreen() ?? false,
  });

  registerContractHandler({
    handle,
    contract: clipboardContracts.writeText,
    handler: async ({ text }) => {
      if (!clipboard) {
        throw new Error("clipboard module is unavailable");
      }
      clipboard.writeText(text);
    },
  });
}
