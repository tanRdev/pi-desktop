import { mkdirSync } from "node:fs";
import path from "node:path";
import type {
  AgentSnapshot,
  AutocompleteContext,
  AutocompleteSuggestions,
  ModelSwitchRequest,
  PiDeskAgentEvent,
  PiDiscoveryResult,
  ProviderSnapshot,
  SearchRequest,
  SearchResponse,
  SettingsSnapshot,
} from "@pidesk/shared";
import { IPC_CHANNELS } from "@pidesk/shared";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import {
  createThreadTitle,
  getDefaultThreadTitle,
} from "../thread-title-defaults";
import { createAgentHostClient } from "./agent-host-client";
import {
  createUnavailableAgentHost,
  resolveAgentRuntimeOptions,
} from "./agent-host-runtime";
import agentHostSessionServerEntryPath from "./agent-host-session-server-entry?modulePath";
import {
  type AgentHostSocketTransport,
  createAgentHostSocketTransport,
} from "./agent-host-socket-transport";
import { AppPreferencesCatalog } from "./app-preferences-catalog";
import { switchModelForContext } from "./bootstrap/model-switch";
import {
  buildThreadContext as buildThreadContextFromHelper,
  type ResolvedRepositoryInspection,
  type SelectedThreadContext,
} from "./bootstrap/thread-context";
import { resolveWorkspaceInspection } from "./bootstrap/workspace-inspection";
import { createContextSwitchController } from "./context-switch-controller";
import { GitWorktreeService } from "./git-worktree-service";
import { registerIpcHandlers } from "./ipc-router";
import { LocalThreadRuntimeManager } from "./local-thread-runtime-manager";
import { PackagesServiceImpl } from "./packages/packages-service-impl";
import {
  discoverPiResources,
  getPiSlashSuggestions,
} from "./pi-resource-discovery";
import { RepositoryCatalog } from "./repository-catalog";
import { RepositoryPreferencesCatalog } from "./repository-preferences-catalog";
import { SelectionState } from "./selection-state";
import { buildShellCatalog } from "./shell-catalog-builder";
import { createShellSnapshot } from "./shell-snapshot";
import { terminalManager } from "./terminal-manager";
import { ThreadCatalog, type ThreadCatalogEntry } from "./thread-catalog";
import { createThreadRuntimeLaunchDetails } from "./thread-runtime-launch";
import {
  createMainWindowOptions,
  hardenMainWindow,
  resolvePreloadTarget,
  resolveRendererTarget,
  shouldDeferWindowShowUntilReady,
  shouldShowMainWindow,
} from "./window-config";
import { WorkspaceSearchService } from "./workspace-search-service";
import { WorkspaceSessionCatalog } from "./workspace-session-catalog";

let mainWindow: BrowserWindow | null = null;

const AGENT_BOOTSTRAP_ERROR_SESSION_ID = "bootstrap-error";
const SOCKET_CONNECT_TIMEOUT_MS = 5_000;
const SOCKET_CONNECT_RETRY_MS = 50;
const NON_REPOSITORY_WORKSPACE_MESSAGE =
  "This folder is open, but it is not a git repository.";

type AgentDesktopHost = {
  getProviders(): Promise<ProviderSnapshot[]>;
  getSettings(): Promise<SettingsSnapshot>;
  getSnapshot(): Promise<AgentSnapshot>;
  prompt(text: string): Promise<void>;
  cancelPrompt(): Promise<void>;
  reset(): Promise<void>;
  subscribe(listener: (event: PiDeskAgentEvent) => void): () => void;
};

function createBootstrapErrorHost(message: string): AgentDesktopHost {
  const unavailableHost = createUnavailableAgentHost(message);

  return {
    async getSnapshot() {
      const snapshot = await unavailableHost.getSnapshot();

      return {
        ...snapshot,
        sessionId: AGENT_BOOTSTRAP_ERROR_SESSION_ID,
      };
    },
    async getProviders() {
      return [];
    },
    async getSettings() {
      return {};
    },
    async prompt(text: string) {
      await unavailableHost.prompt(text);
    },
    async cancelPrompt() {
      await unavailableHost.cancelPrompt();
    },
    async reset() {
      return;
    },
    subscribe() {
      return () => {};
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getEventTimestamp(event: PiDeskAgentEvent): number | null {
  return "timestamp" in event && typeof event.timestamp === "number"
    ? event.timestamp
    : null;
}

async function createMainWindow() {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  const windowOptions = createMainWindowOptions({
    preloadPath: resolvePreloadTarget(import.meta.url),
  });
  const window = new BrowserWindow(windowOptions);
  hardenMainWindow(window);

  if (shouldShowMainWindow(process.env)) {
    const showWindow = () => {
      window.show();
    };

    if (shouldDeferWindowShowUntilReady(windowOptions)) {
      window.once("ready-to-show", showWindow);
    } else {
      showWindow();
    }
  }

  const rendererTarget = resolveRendererTarget(rendererUrl, import.meta.url);
  if (rendererTarget.kind === "url") {
    await window.loadURL(rendererTarget.value);
  } else {
    await window.loadFile(rendererTarget.value);
  }

  return window;
}

function subscribeToFullscreenChanges(window: BrowserWindow) {
  const emitFullscreenState = () => {
    window.webContents.send(
      IPC_CHANNELS.window.fullscreenChanged,
      window.isFullScreen(),
    );
  };

  window.on("enter-full-screen", emitFullscreenState);
  window.on("leave-full-screen", emitFullscreenState);
  window.on("ready-to-show", emitFullscreenState);

  return () => {
    window.removeListener("enter-full-screen", emitFullscreenState);
    window.removeListener("leave-full-screen", emitFullscreenState);
    window.removeListener("ready-to-show", emitFullscreenState);
  };
}

async function bootstrapDesktop() {
  await app.whenReady();
  app.setName("Pi Desktop");

  const explicitUserDataPath = process.env.PIDESK_USER_DATA_DIR;
  if (explicitUserDataPath) {
    app.setPath("userData", explicitUserDataPath);
  } else if (process.env.NODE_ENV === "test") {
    const testHomePath = process.env.HOME ?? app.getPath("home");
    app.setPath("userData", path.join(testHomePath, ".pidesk-test-user-data"));
  }

  const userDataPath = app.getPath("userData");
  const gitService = new GitWorktreeService();
  const repositoryCatalog = new RepositoryCatalog(userDataPath);
  const repositoryPreferencesCatalog = new RepositoryPreferencesCatalog(
    userDataPath,
  );
  repositoryPreferencesCatalog.importLegacyLabels(repositoryCatalog.list());
  const workspaceSessionCatalog = new WorkspaceSessionCatalog(userDataPath);
  const appPreferencesCatalog = new AppPreferencesCatalog(userDataPath);
  const threadCatalog = new ThreadCatalog(userDataPath);
  const selectionState = new SelectionState(userDataPath);
  const runtimeManager = new LocalThreadRuntimeManager();
  const runtimeSocketDirectory = path.join(app.getPath("temp"), "pd");
  mkdirSync(runtimeSocketDirectory, { recursive: true });

  let currentContext: SelectedThreadContext | null = null;
  let currentTransport: AgentHostSocketTransport | null = null;
  let currentHost: AgentDesktopHost = createBootstrapErrorHost(
    "Pi Desktop agent host has not been attached yet",
  );
  const workspaceSearchService = new WorkspaceSearchService();
  const defaultAgentDirectory = path.join(app.getPath("home"), ".pi", "agent");
  const packagesService = new PackagesServiceImpl({
    homePath: app.getPath("home"),
    getLocalSettingsPath: () =>
      currentContext?.worktreePath
        ? path.join(currentContext.worktreePath, ".pi", "settings.json")
        : null,
    getLocalWorkingDirectory: () =>
      currentContext?.worktreePath ?? selectionState.get().worktreeId,
    emit: (event) => {
      mainWindow?.webContents.send(IPC_CHANNELS.packages.event, event);
    },
  });

  const subscribeToHost = (
    host: AgentDesktopHost,
    thread: ThreadCatalogEntry | null,
  ): (() => void) =>
    host.subscribe((event) => {
      const timestamp = getEventTimestamp(event);
      if (thread && timestamp !== null) {
        threadCatalog.touch(thread.id, timestamp);
      }
      mainWindow?.webContents.send(IPC_CHANNELS.agent.event, event);
    });

  let unsubscribe = subscribeToHost(currentHost, null);
  const notifySessionChanged = () => {
    mainWindow?.webContents.send(IPC_CHANNELS.agent.event, {
      type: "session_changed",
    });
  };

  function resolveAgentDirectory(): string {
    return currentContext?.runtimeAgentDirectory ?? defaultAgentDirectory;
  }

  function resolveContextCwd(): string {
    return (
      currentContext?.worktreePath ??
      selectionState.get().worktreeId ??
      process.cwd()
    );
  }

  async function handleSwitchModel(request: ModelSwitchRequest): Promise<void> {
    await switchModelForContext(request, {
      currentContext,
      resolveAgentDirectory,
      createSettingsManager: async (worktreePath, agentDirectory) => {
        const { SettingsManager } = await import(
          "@mariozechner/pi-coding-agent"
        );

        return SettingsManager.create(worktreePath, agentDirectory);
      },
      runtimeManager,
      attachContext,
      commitAttachment,
    });
  }

  async function handleGetDiscovery(): Promise<PiDiscoveryResult> {
    return discoverPiResources(resolveAgentDirectory(), resolveContextCwd());
  }

  async function handleGetSlashSuggestions(
    context: AutocompleteContext,
  ): Promise<AutocompleteSuggestions> {
    return getPiSlashSuggestions({
      agentDir: resolveAgentDirectory(),
      cwd: resolveContextCwd(),
      context,
    });
  }

  async function handleSearchFiles(
    request: SearchRequest,
  ): Promise<SearchResponse> {
    return workspaceSearchService.search(request);
  }

  async function connectSocketHost(socketPath: string): Promise<{
    host: AgentDesktopHost;
    transport: AgentHostSocketTransport;
  }> {
    const deadline = Date.now() + SOCKET_CONNECT_TIMEOUT_MS;
    let lastError: Error | null = null;

    while (Date.now() < deadline) {
      const transport = createAgentHostSocketTransport(socketPath);
      try {
        await transport.connect();
        const host = createAgentHostClient(transport);
        await host.bootstrap();
        return { host, transport };
      } catch (error) {
        transport.close();
        lastError =
          error instanceof Error
            ? error
            : new Error(String(error ?? "Unknown socket connect error"));
        await delay(SOCKET_CONNECT_RETRY_MS);
      }
    }

    throw (
      lastError ??
      new Error(`Timed out connecting to agent session socket at ${socketPath}`)
    );
  }

  function inspectWorktreeOrThrow(
    targetPath: string,
  ): ResolvedRepositoryInspection {
    const inspection = gitService.inspect(targetPath);
    const resolvedInspection = resolveWorkspaceInspection(
      targetPath,
      inspection,
    );

    if (!resolvedInspection) {
      throw new Error("Selected directory is not inside a git repository");
    }

    return resolvedInspection;
  }

  function buildThreadContext(
    repositoryId: string,
    inspection: ResolvedRepositoryInspection,
    thread: ThreadCatalogEntry,
  ): SelectedThreadContext {
    return buildThreadContextFromHelper({
      repositoryId,
      inspection,
      thread,
      environment: process.env,
      runtimeSocketDirectory,
      execPath: process.execPath,
      sessionServerEntryPath: agentHostSessionServerEntryPath,
      repositoryCatalog,
      selectionState,
      ensureDirectory: mkdirSync,
      resolveRuntimeOptions: (environment, cwd) => {
        const runtimeOptions = resolveAgentRuntimeOptions(environment, cwd);
        return {
          mode: runtimeOptions.mode,
          cwd: runtimeOptions.cwd,
          agentDir: environment.PIDESK_AGENT_DIR || defaultAgentDirectory,
        };
      },
      createLaunchDetails: (input) =>
        createThreadRuntimeLaunchDetails({
          ...input,
          agentDirectory: input.agentDirectory ?? undefined,
        }),
    });
  }

  async function resolveDefaultThreadContext(
    targetPath: string,
  ): Promise<SelectedThreadContext> {
    const inspection = inspectWorktreeOrThrow(targetPath);
    const repositoryEntry = repositoryCatalog.upsert({
      rootPath: inspection.rootPath,
    });
    const thread =
      threadCatalog
        .listByWorktree(inspection.currentWorktreePath)
        .find((entry) => entry.archivedAt === null) ??
      threadCatalog.create({
        worktreeId: inspection.currentWorktreePath,
        title: getDefaultThreadTitle(),
      });

    return buildThreadContext(repositoryEntry.id, inspection, thread);
  }

  async function createWorktreeContext(
    repositoryId: string,
    branchName: string,
  ): Promise<SelectedThreadContext> {
    const repository = repositoryCatalog.get(repositoryId);
    if (!repository) {
      throw new Error(`Unknown repository: ${repositoryId}`);
    }

    const inspection = inspectWorktreeOrThrow(repository.rootPath);
    const trimmedBranchName = branchName.trim();
    if (!trimmedBranchName) {
      throw new Error("Worktree branch name must not be empty");
    }

    const worktreePath = path.join(
      app.getPath("home"),
      ".worktrees",
      path.basename(repository.rootPath),
      trimmedBranchName.replace(/[\\/]+/g, "-"),
    );
    const createdWorktreePath = gitService.createWorktree({
      repositoryRoot: repository.rootPath,
      branchName: trimmedBranchName,
      worktreePath,
      baseBranch: inspection.defaultBranch ?? undefined,
    });

    return resolveDefaultThreadContext(createdWorktreePath);
  }

  async function resolveThreadContext(
    threadId: string,
  ): Promise<SelectedThreadContext> {
    const thread = threadCatalog.get(threadId);
    if (!thread) {
      throw new Error(`Unknown thread: ${threadId}`);
    }

    const inspection = inspectWorktreeOrThrow(thread.worktreeId);
    const repositoryEntry = repositoryCatalog.upsert({
      rootPath: inspection.rootPath,
    });

    return buildThreadContext(repositoryEntry.id, inspection, thread);
  }

  async function createThreadContext(
    worktreeId: string,
  ): Promise<SelectedThreadContext> {
    const inspection = inspectWorktreeOrThrow(worktreeId);
    const usedTitles = new Set(
      threadCatalog
        .listByWorktree(inspection.currentWorktreePath)
        .map((thread) => thread.title),
    );
    const thread = threadCatalog.create({
      worktreeId: inspection.currentWorktreePath,
      title: createThreadTitle(Math.random, usedTitles),
    });
    const repositoryEntry = repositoryCatalog.upsert({
      rootPath: inspection.rootPath,
    });

    return buildThreadContext(repositoryEntry.id, inspection, thread);
  }

  async function attachContext(context: SelectedThreadContext): Promise<{
    context: SelectedThreadContext;
    host: AgentDesktopHost;
    transport: AgentHostSocketTransport;
  }> {
    const launchSpec = {
      threadId: context.thread.id,
      worktreePath: context.worktreePath,
      command: context.command,
    };

    await runtimeManager.ensureThreadRuntime(launchSpec);

    try {
      const { host, transport } = await connectSocketHost(context.socketPath);
      return { context, host, transport };
    } catch {
      await runtimeManager.restartThreadRuntime(launchSpec);
      const { host, transport } = await connectSocketHost(context.socketPath);
      return { context, host, transport };
    }
  }

  async function attachToPath(targetPath: string) {
    return attachContext(await resolveDefaultThreadContext(targetPath));
  }

  function selectFolderWorkspace(targetPath: string): void {
    const repositoryEntry = repositoryCatalog.upsert({ rootPath: targetPath });
    const previousTransport = currentTransport;
    const previousUnsubscribe = unsubscribe;

    currentContext = null;
    currentHost = createBootstrapErrorHost(NON_REPOSITORY_WORKSPACE_MESSAGE);
    currentTransport = null;
    unsubscribe = subscribeToHost(currentHost, null);
    selectionState.replace({
      repositoryId: repositoryEntry.id,
      worktreeId: null,
      threadId: null,
    });

    previousUnsubscribe();
    previousTransport?.close();
  }

  async function activateWorkspacePath(targetPath: string): Promise<void> {
    const inspection = gitService.inspect(targetPath);

    if (
      inspection.status === "repository" &&
      inspection.rootPath &&
      inspection.currentWorktreePath &&
      inspection.worktrees
    ) {
      commitAttachment(await attachToPath(targetPath));
      return;
    }

    if (inspection.status === "not_repo") {
      selectFolderWorkspace(targetPath);
      return;
    }

    throw new Error(inspection.message ?? "Selected directory is unavailable");
  }

  function commitAttachment(attached: {
    context: SelectedThreadContext;
    host: AgentDesktopHost;
    transport: AgentHostSocketTransport;
  }): void {
    const previousTransport = currentTransport;
    const previousUnsubscribe = unsubscribe;

    currentContext = attached.context;
    currentHost = attached.host;
    currentTransport = attached.transport;
    unsubscribe = subscribeToHost(currentHost, currentContext.thread);

    previousUnsubscribe();
    previousTransport?.close();
  }

  const contextSwitchController = createContextSwitchController(
    {
      get context() {
        return currentContext;
      },
      set context(value) {
        currentContext = value;
      },
      get host() {
        return currentHost;
      },
      set host(value) {
        currentHost = value;
      },
      get transport() {
        return currentTransport;
      },
      set transport(value) {
        currentTransport = value;
      },
      get unsubscribe() {
        return unsubscribe;
      },
      set unsubscribe(value) {
        unsubscribe = value;
      },
    },
    {
      attachContext,
      subscribeToHost: (host, thread) =>
        subscribeToHost(host, thread ? threadCatalog.get(thread.id) : null),
      notifySessionChanged,
    },
  );

  const preferredSelection = selectionState.get();
  const preferredWorkspacePath =
    preferredSelection.worktreeId ??
    preferredSelection.repositoryId ??
    process.cwd();

  try {
    await activateWorkspacePath(preferredWorkspacePath);
  } catch (error) {
    const fallbackPath = process.cwd();
    if (preferredWorkspacePath !== fallbackPath) {
      try {
        await activateWorkspacePath(fallbackPath);
      } catch (fallbackError) {
        currentHost = createBootstrapErrorHost(
          fallbackError instanceof Error
            ? fallbackError.message
            : "Unknown agent host error",
        );
        unsubscribe();
        unsubscribe = subscribeToHost(currentHost, null);
      }
    } else {
      currentHost = createBootstrapErrorHost(
        error instanceof Error ? error.message : "Unknown agent host error",
      );
      unsubscribe();
      unsubscribe = subscribeToHost(currentHost, null);
    }
  }

  function switchContextInBackground(context: SelectedThreadContext): void {
    void contextSwitchController.switchContext(async () => context);
  }

  async function switchRepositoryPath(targetPath: string): Promise<void> {
    const inspection = gitService.inspect(targetPath);

    if (
      inspection.status === "repository" &&
      inspection.rootPath &&
      inspection.currentWorktreePath &&
      inspection.worktrees
    ) {
      switchContextInBackground(await resolveDefaultThreadContext(targetPath));
      return;
    }

    await activateWorkspacePath(targetPath);
    notifySessionChanged();
  }

  async function archiveThreadAndRefresh(threadId: string): Promise<void> {
    const thread = threadCatalog.get(threadId);
    if (!thread) {
      throw new Error(`Unknown thread: ${threadId}`);
    }

    const isActiveThread =
      (currentContext?.thread.id ?? selectionState.get().threadId) === threadId;

    threadCatalog.archive(threadId);

    if (!isActiveThread) {
      notifySessionChanged();
      return;
    }

    const nextOpenThread = threadCatalog
      .listByWorktree(thread.worktreeId)
      .find((entry) => entry.id !== threadId && entry.archivedAt === null);

    if (!nextOpenThread) {
      const repositoryId =
        currentContext?.repositoryId ?? selectionState.get().repositoryId;
      currentContext = null;
      currentTransport?.close();
      currentTransport = null;
      unsubscribe();
      unsubscribe = () => {};
      currentHost = createBootstrapErrorHost(
        "No active session is selected for this workspace",
      );
      selectionState.replace({
        repositoryId,
        worktreeId: thread.worktreeId,
        threadId: null,
      });
      notifySessionChanged();
      return;
    }

    switchContextInBackground(await resolveThreadContext(nextOpenThread.id));
  }

  async function deleteThreadAndRefresh(threadId: string): Promise<void> {
    const thread = threadCatalog.get(threadId);
    if (!thread) {
      throw new Error(`Unknown thread: ${threadId}`);
    }

    const isActiveThread =
      (currentContext?.thread.id ?? selectionState.get().threadId) === threadId;

    threadCatalog.delete(threadId);

    if (!isActiveThread) {
      notifySessionChanged();
      return;
    }

    const nextOpenThread = threadCatalog
      .listByWorktree(thread.worktreeId)
      .find((entry) => entry.id !== threadId && entry.archivedAt === null);

    if (!nextOpenThread) {
      const repositoryId =
        currentContext?.repositoryId ?? selectionState.get().repositoryId;
      currentContext = null;
      currentTransport?.close();
      currentTransport = null;
      unsubscribe();
      unsubscribe = () => {};
      currentHost = createBootstrapErrorHost(
        "No active session is selected for this workspace",
      );
      selectionState.replace({
        repositoryId,
        worktreeId: thread.worktreeId,
        threadId: null,
      });
      notifySessionChanged();
      return;
    }

    switchContextInBackground(await resolveThreadContext(nextOpenThread.id));
  }

  registerIpcHandlers({
    handle: ipcMain.handle.bind(ipcMain),
    getShellSnapshot: async () => {
      let agentSnapshot: AgentSnapshot | null = null;
      try {
        agentSnapshot = await currentHost.getSnapshot();
      } catch (error) {
        agentSnapshot = {
          sessionId: AGENT_BOOTSTRAP_ERROR_SESSION_ID,
          status: "error",
          messages: [],
          lastError:
            error instanceof Error ? error.message : "Unknown agent host error",
        };
      }

      const selection = currentContext
        ? {
            repositoryId: currentContext.repositoryId,
            worktreeId: currentContext.worktreePath,
            threadId: currentContext.thread.id,
          }
        : selectionState.get();
      const catalog = await buildShellCatalog({
        repositories: repositoryCatalog.list(),
        selection,
        repositoryPreferences: repositoryPreferencesCatalog.list(),
        workspaceSessions: workspaceSessionCatalog.list(),
        inspectRepository: (rootPath) => gitService.inspect(rootPath),
        listThreadsByWorktree: (worktreeId) =>
          threadCatalog.listByWorktree(worktreeId),
        getRuntimeState: (thread) => runtimeManager.getRuntimeState(thread),
        selectedAgentSnapshot: agentSnapshot,
      });
      selectionState.replace(catalog.selection);
      workspaceSessionCatalog.replaceAll(
        catalog.reconciledWorkspaceSessions ?? [],
      );

      return createShellSnapshot({
        appName: app.getName(),
        appVersion: app.getVersion(),
        chromeVersion: process.versions.chrome,
        electronVersion: process.versions.electron,
        platform: process.platform,
        env: process.env,
        isPackaged: app.isPackaged,
        cwd:
          selection.worktreeId ??
          selection.repositoryId ??
          preferredWorkspacePath,
        agentDir: currentContext?.agentDirectory ?? undefined,
        agentMode: currentContext?.agentMode,
        agentSnapshot,
        catalog,
      });
    },
    getWorkspaceRootPath: () =>
      currentContext?.worktreePath ?? selectionState.get().worktreeId,
    agentHost: {
      getProviders: () => currentHost.getProviders(),
      getSettings: () => currentHost.getSettings(),
      getSnapshot: () => currentHost.getSnapshot(),
      prompt: (text) => currentHost.prompt(text),
      cancelPrompt: () => currentHost.cancelPrompt(),
      reset: () => currentHost.reset(),
      addRepository: async (targetPath) => {
        await switchRepositoryPath(targetPath);
      },
      reorderRepositories: async (repositoryIds) => {
        repositoryCatalog.reorder(repositoryIds);
      },
      selectRepository: async (repositoryId) => {
        const repository = repositoryCatalog.get(repositoryId);
        if (!repository) {
          throw new Error(`Unknown repository: ${repositoryId}`);
        }

        await switchRepositoryPath(
          repository.lastSelectedWorktreeId ?? repository.rootPath,
        );
      },
      removeRepository: async (repositoryId) => {
        const repository = repositoryCatalog.get(repositoryId);
        if (!repository) {
          throw new Error(`Unknown repository: ${repositoryId}`);
        }

        const isActiveRepository =
          (currentContext?.repositoryId ??
            selectionState.get().repositoryId) === repository.id;

        repositoryCatalog.remove(repositoryId);
        repositoryPreferencesCatalog.remove(repositoryId);

        const remainingRepositories = repositoryCatalog.list();
        if (remainingRepositories.length === 0) {
          selectionState.clear();
          return;
        }

        if (!isActiveRepository) {
          notifySessionChanged();
          return;
        }

        const nextRepository =
          remainingRepositories.find((entry) => entry.id !== repository.id) ??
          remainingRepositories[0] ??
          null;

        if (!nextRepository) {
          selectionState.clear();
          return;
        }

        await activateWorkspacePath(
          nextRepository.lastSelectedWorktreeId ?? nextRepository.rootPath,
        );
        notifySessionChanged();
      },
      openRepositoryInFinder: async (repositoryId) => {
        const repository = repositoryCatalog.get(repositoryId);
        if (!repository) {
          throw new Error(`Unknown repository: ${repositoryId}`);
        }

        await shell.openPath(repository.rootPath);
      },
      createWorktree: async (repositoryId, branchName) => {
        switchContextInBackground(
          await createWorktreeContext(repositoryId, branchName),
        );
      },
      selectWorktree: async (worktreeId) => {
        switchContextInBackground(
          await resolveDefaultThreadContext(worktreeId),
        );
      },
      createThread: async (worktreeId) => {
        const context = await createThreadContext(worktreeId);
        switchContextInBackground(context);
        return context.thread.id;
      },
      selectThread: async (threadId) => {
        switchContextInBackground(await resolveThreadContext(threadId));
      },
      archiveThread: async (threadId) => {
        await archiveThreadAndRefresh(threadId);
      },
      deleteThread: async (threadId) => {
        await deleteThreadAndRefresh(threadId);
      },
    },
    gitService,
    stateHost: {
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
      importLegacyPreferences: async (importData) => {
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
          settings:
            importData.settings && typeof importData.settings === "object"
              ? importData.settings
              : undefined,
        });

        return {
          repositoryPreferences,
          appPreferences,
        };
      },
    },
    mainWindow: null,
    searchFiles: handleSearchFiles,
    switchModel: handleSwitchModel,
    getDiscovery: handleGetDiscovery,
    getSlashSuggestions: handleGetSlashSuggestions,
    threadCatalog,
    packagesService,
  });

  mainWindow = await createMainWindow();
  terminalManager.setMainWindow(mainWindow);
  let unsubscribeFullscreen = subscribeToFullscreenChanges(mainWindow);
  mainWindow.on("closed", () => {
    unsubscribeFullscreen();
    mainWindow = null;
  });

  app.once("will-quit", () => {
    unsubscribe();
    currentTransport?.close();
    terminalManager.destroyAll();
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createMainWindow();
      terminalManager.setMainWindow(mainWindow);
      unsubscribeFullscreen = subscribeToFullscreenChanges(mainWindow);
      mainWindow.on("closed", () => {
        unsubscribeFullscreen();
        mainWindow = null;
      });
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

void bootstrapDesktop();
