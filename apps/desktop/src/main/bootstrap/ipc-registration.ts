import {
  DEFAULT_UNTITLED_THREAD_TITLE,
  generateThreadTitleFromMessage,
} from "../../thread-title-defaults";
import type { AppPreferencesCatalog } from "../app-preferences-catalog";
import type { GitWorktreeService } from "../git-worktree-service";
import type { StateIpcHost } from "../ipc/register-state-handlers";
import type {
  AgentIpcHost,
  IpcRegistrar,
  RegisterIpcHandlersDependencies,
} from "../ipc-router";
import type { PackagesService } from "../packages/packages-service";
import type {
  RepositoryCatalog,
  RepositoryCatalogEntry,
} from "../repository-catalog";
import type { RepositoryPreferencesCatalog } from "../repository-preferences-catalog";
import type { ThreadCatalog, ThreadCatalogEntry } from "../thread-catalog";
import type { WorkspaceSessionCatalog } from "../workspace-session-catalog";
import { deleteThreadAndRefresh } from "./active-thread-deletion";
import type {
  ResolvedRepositoryInspection,
  SelectedThreadContext,
} from "./thread-context";

type AgentDesktopHost = {
  getProviders: AgentIpcHost["getProviders"];
  getSettings: AgentIpcHost["getSettings"];
  getSnapshot: AgentIpcHost["getSnapshot"];
  prompt: AgentIpcHost["prompt"];
  cancelPrompt: AgentIpcHost["cancelPrompt"];
  reset: AgentIpcHost["reset"];
};

type AgentIpcHostDependencies = {
  getCurrentContext(): SelectedThreadContext | null;
  getCurrentHost(): AgentDesktopHost;
  getSelectedRepositoryId(): string | null;
  getSelectedThreadId(): string | null;
  threadCatalog: Pick<
    ThreadCatalog,
    "get" | "rename" | "listByWorktree" | "delete"
  >;
  notifySessionChanged(): void;
  repositoryCatalog: Pick<RepositoryCatalog, "get" | "reorder" | "upsert">;
  workspaceRemovalActions: {
    removeRepository(repositoryId: string): Promise<void>;
    removeWorktree(worktreeId: string): Promise<void>;
  };
  switchRepositoryPath(
    targetPath: string,
    options?: { createIfMissing?: boolean },
  ): Promise<void>;
  shellOpenPath(targetPath: string): Promise<string>;
  createWorktreeContext(
    repositoryId: string,
    branchName: string,
  ): Promise<SelectedThreadContext | null>;
  switchContextInBackground(context: SelectedThreadContext): void;
  resolveDefaultThreadContext(
    worktreeId: string,
    options?: { createIfMissing?: boolean },
  ): Promise<SelectedThreadContext | null>;
  getRepositoryIdForWorktree(worktreeId: string): string | null;
  selectWorktreeWithoutThread(
    repositoryId: string | null,
    worktreeId: string,
  ): void;
  threadWorkspaceActions: {
    createThread(worktreeId: string): Promise<string>;
    selectThread(threadId: string): Promise<void>;
  };
  inspectWorktreeOrThrow(targetPath: string): ResolvedRepositoryInspection;
  buildThreadContext(
    repositoryId: string,
    inspection: ResolvedRepositoryInspection,
    thread: ThreadCatalogEntry,
  ): SelectedThreadContext;
};

type ShellStateIpcDependencies = {
  getShellSnapshot: RegisterIpcHandlersDependencies["getShellSnapshot"];
  getWorkspaceRootPath: NonNullable<
    RegisterIpcHandlersDependencies["getWorkspaceRootPath"]
  >;
  getAllowedRepositoryRoots: NonNullable<
    RegisterIpcHandlersDependencies["getAllowedRepositoryRoots"]
  >;
  getAllowedTerminalCwds: NonNullable<
    RegisterIpcHandlersDependencies["getAllowedTerminalCwds"]
  >;
};

type ImportLegacyPreferencesInput = Parameters<
  StateIpcHost["importLegacyPreferences"]
>[0];

type StateCatalogDependencies = {
  repositoryPreferencesCatalog: Pick<
    RepositoryPreferencesCatalog,
    "get" | "upsert"
  >;
  workspaceSessionCatalog: Pick<WorkspaceSessionCatalog, "get" | "save">;
  appPreferencesCatalog: Pick<AppPreferencesCatalog, "get" | "update">;
  readImportedAiPreferences(
    value: unknown,
  ): { provider?: string; model?: string } | undefined;
  isRecord(value: unknown): value is Record<string, unknown>;
};

type CreateDesktopIpcHandlerDependenciesInput = {
  handle: IpcRegistrar["handle"];
  createSanitizingHandle: (
    inner: IpcRegistrar["handle"],
    options: { log(error: unknown): void },
  ) => IpcRegistrar["handle"];
  logIpcError(error: unknown): void;
  shellStateIpc: ShellStateIpcDependencies;
  agentHost: AgentIpcHost;
  stateHost?: StateIpcHost;
  mainWindow: RegisterIpcHandlersDependencies["mainWindow"];
  gitService: GitWorktreeService;
  searchFiles: NonNullable<RegisterIpcHandlersDependencies["searchFiles"]>;
  switchModel: NonNullable<RegisterIpcHandlersDependencies["switchModel"]>;
  getOAuthProviders: NonNullable<
    RegisterIpcHandlersDependencies["getOAuthProviders"]
  >;
  loginWithOAuth: NonNullable<
    RegisterIpcHandlersDependencies["loginWithOAuth"]
  >;
  logoutOAuth: NonNullable<RegisterIpcHandlersDependencies["logoutOAuth"]>;
  getDiscovery: NonNullable<RegisterIpcHandlersDependencies["getDiscovery"]>;
  getSlashSuggestions: NonNullable<
    RegisterIpcHandlersDependencies["getSlashSuggestions"]
  >;
  threadCatalog: ThreadCatalog;
  packagesService: PackagesService;
} & Partial<StateCatalogDependencies>;

function createStateIpcHost(
  input: Partial<StateCatalogDependencies>,
): StateIpcHost | undefined {
  if (
    !input.repositoryPreferencesCatalog ||
    !input.workspaceSessionCatalog ||
    !input.appPreferencesCatalog ||
    !input.readImportedAiPreferences ||
    !input.isRecord
  ) {
    return undefined;
  }

  const repositoryPreferencesCatalog = input.repositoryPreferencesCatalog;
  const workspaceSessionCatalog = input.workspaceSessionCatalog;
  const appPreferencesCatalog = input.appPreferencesCatalog;
  const readImportedAiPreferences = input.readImportedAiPreferences;
  const isRecord = input.isRecord;

  return {
    getRepositoryPreferences: async (repositoryId) =>
      repositoryPreferencesCatalog.get(repositoryId),
    updateRepositoryPreferences: async (repositoryId, updates) =>
      repositoryPreferencesCatalog.upsert(repositoryId, updates),
    getWorkspaceSession: async (worktreeId) =>
      workspaceSessionCatalog.get(worktreeId),
    saveWorkspaceSession: async (session) =>
      workspaceSessionCatalog.save(session),
    getAppPreferences: async () => appPreferencesCatalog.get(),
    updateAppPreferences: async (updates) =>
      appPreferencesCatalog.update(updates),
    importLegacyPreferences: async (
      importData: ImportLegacyPreferencesInput,
    ) => {
      const importedAi = isRecord(importData.settings)
        ? readImportedAiPreferences(importData.settings.ai)
        : undefined;
      const repositoryPreferences = (importData.repositories ?? []).map(
        (repository) =>
          repositoryPreferencesCatalog.upsert(repository.repositoryId, {
            customName: repository.customName,
            icon: repository.icon,
            accentColor: repository.accentColor,
          }),
      );
      const appPreferences = appPreferencesCatalog.update({
        leftSidebarWidth: importData.leftSidebarWidth,
        ai: importedAi,
      });

      return {
        repositoryPreferences,
        appPreferences,
      };
    },
  };
}

function getRepositoryOrThrow(
  repositoryCatalog: Pick<RepositoryCatalog, "get">,
  repositoryId: string,
): RepositoryCatalogEntry {
  const repository = repositoryCatalog.get(repositoryId);
  if (!repository) {
    throw new Error(`Unknown repository: ${repositoryId}`);
  }

  return repository;
}

export function createAgentIpcHost(
  input: AgentIpcHostDependencies,
): AgentIpcHost {
  return {
    getProviders: () => input.getCurrentHost().getProviders(),
    getSettings: () => input.getCurrentHost().getSettings(),
    getSnapshot: () => input.getCurrentHost().getSnapshot(),
    prompt: async (text) => {
      const currentThread = input.getCurrentContext()?.thread;
      if (currentThread) {
        const threadEntry = input.threadCatalog.get(currentThread.id);
        if (threadEntry?.title === DEFAULT_UNTITLED_THREAD_TITLE) {
          const newTitle = generateThreadTitleFromMessage(text);
          input.threadCatalog.rename(currentThread.id, newTitle);
          input.notifySessionChanged();
        }
      }

      await input.getCurrentHost().prompt(text);
    },
    cancelPrompt: () => input.getCurrentHost().cancelPrompt(),
    reset: () => input.getCurrentHost().reset(),
    addRepository: async (targetPath) => {
      await input.switchRepositoryPath(targetPath);
    },
    reorderRepositories: async (repositoryIds) => {
      input.repositoryCatalog.reorder(repositoryIds);
    },
    selectRepository: async (repositoryId) => {
      const repository = getRepositoryOrThrow(
        input.repositoryCatalog,
        repositoryId,
      );
      await input.switchRepositoryPath(
        repository.lastSelectedWorktreeId ?? repository.rootPath,
        { createIfMissing: false },
      );
    },
    removeRepository: async (repositoryId) =>
      input.workspaceRemovalActions.removeRepository(repositoryId),
    openRepositoryInFinder: async (repositoryId) => {
      const repository = getRepositoryOrThrow(
        input.repositoryCatalog,
        repositoryId,
      );
      await input.shellOpenPath(repository.rootPath);
    },
    createWorktree: async (repositoryId, branchName) => {
      const context = await input.createWorktreeContext(
        repositoryId,
        branchName,
      );
      if (!context) {
        throw new Error(
          "Failed to create a default thread for the new worktree",
        );
      }

      input.switchContextInBackground(context);
    },
    selectWorktree: async (worktreeId) => {
      const context = await input.resolveDefaultThreadContext(worktreeId, {
        createIfMissing: false,
      });
      if (!context) {
        const repositoryId = input.getRepositoryIdForWorktree(worktreeId);
        input.selectWorktreeWithoutThread(repositoryId, worktreeId);
        return;
      }

      input.switchContextInBackground(context);
    },
    removeWorktree: async (worktreeId) =>
      input.workspaceRemovalActions.removeWorktree(worktreeId),
    createThread: async (worktreeId) =>
      input.threadWorkspaceActions.createThread(worktreeId),
    selectThread: async (threadId) => {
      await input.threadWorkspaceActions.selectThread(threadId);
    },
    deleteThread: async (threadId) => {
      await deleteThreadAndRefresh(threadId, {
        getThread: (id) => input.threadCatalog.get(id) ?? undefined,
        deleteThread: (id) => {
          input.threadCatalog.delete(id);
        },
        listByWorktree: (worktreeId) =>
          input.threadCatalog.listByWorktree(worktreeId),
        getActiveThreadId: () =>
          input.getCurrentContext()?.thread.id ?? input.getSelectedThreadId(),
        getSelectedRepositoryId: () =>
          input.getCurrentContext()?.repositoryId ??
          input.getSelectedRepositoryId(),
        notifySessionChanged: input.notifySessionChanged,
        selectWorktreeWithoutThread: input.selectWorktreeWithoutThread,
        resolveThreadContext: async (nextThreadId) => {
          const thread = input.threadCatalog.get(nextThreadId);
          if (!thread) {
            throw new Error(`Unknown thread: ${nextThreadId}`);
          }

          const inspection = input.inspectWorktreeOrThrow(thread.worktreeId);
          const repositoryEntry = input.repositoryCatalog.upsert({
            rootPath: inspection.rootPath,
          });

          return input.buildThreadContext(
            repositoryEntry.id,
            inspection,
            thread,
          );
        },
        switchContextInBackground: input.switchContextInBackground,
      });
    },
  };
}

export function createDesktopIpcHandlerDependencies(
  input: CreateDesktopIpcHandlerDependenciesInput,
): RegisterIpcHandlersDependencies {
  return {
    handle: input.createSanitizingHandle(input.handle, {
      log: input.logIpcError,
    }),
    getShellSnapshot: input.shellStateIpc.getShellSnapshot,
    getWorkspaceRootPath: input.shellStateIpc.getWorkspaceRootPath,
    agentHost: input.agentHost,
    stateHost: input.stateHost ?? createStateIpcHost(input),
    mainWindow: input.mainWindow,
    gitService: input.gitService,
    searchFiles: input.searchFiles,
    switchModel: input.switchModel,
    getOAuthProviders: input.getOAuthProviders,
    loginWithOAuth: input.loginWithOAuth,
    logoutOAuth: input.logoutOAuth,
    getDiscovery: input.getDiscovery,
    getSlashSuggestions: input.getSlashSuggestions,
    threadCatalog: input.threadCatalog,
    packagesService: input.packagesService,
    getAllowedRepositoryRoots: input.shellStateIpc.getAllowedRepositoryRoots,
    getAllowedTerminalCwds: input.shellStateIpc.getAllowedTerminalCwds,
  };
}
