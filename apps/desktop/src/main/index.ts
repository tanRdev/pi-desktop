import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import type {
  AgentSnapshot,
  ModelSwitchRequest,
  PiDesktopAgentEvent,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";
import { IPC_CHANNELS } from "@pi-desktop/shared";
import { Effect } from "effect";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  shell,
} from "electron";
import { getDefaultThreadTitle } from "../thread-title-defaults";
import { createAgentHostClient } from "./agent-host-client";
import {
  createUnavailableAgentHost,
  resolveAgentRuntimeOptions,
} from "./agent-host-runtime";
import agentHostSessionServerEntryPath from "./agent-host-session-server-entry?modulePath";
import type { AgentHostSocketTransport } from "./agent-host-socket-transport";
import { AppPreferencesCatalog } from "./app-preferences-catalog";
import { initAutoUpdater } from "./auto-updater";
import { connectAgentHostWithRetry } from "./bootstrap/agent-host-connection";
import { createAgentRuntimeHandlers } from "./bootstrap/agent-runtime-handlers";
import { registerDesktopAppLifecycle } from "./bootstrap/app-lifecycle";
import { installApplicationMenu } from "./bootstrap/application-menu";
import { resolveInitialWorkspaceTarget } from "./bootstrap/initial-workspace";
import { activateInitialWorkspaceSelection } from "./bootstrap/initial-workspace-activation";
import {
  createAgentIpcHost,
  createDesktopIpcHandlerDependencies,
} from "./bootstrap/ipc-registration";
import {
  createMainWindow,
  subscribeToFullscreenChanges,
} from "./bootstrap/main-window";
import { createAndTrackMainWindow } from "./bootstrap/main-window-lifecycle";
import { createOAuthPromptBridge } from "./bootstrap/oauth-prompt-bridge";
import { createShellStateIpcDependencies } from "./bootstrap/shell-state-ipc";
import {
  buildThreadContext as buildThreadContextFromHelper,
  type ResolvedRepositoryInspection,
  type SelectedThreadContext,
} from "./bootstrap/thread-context";
import { createThreadContextActions } from "./bootstrap/thread-context-actions";
import { createThreadWorkspaceActions } from "./bootstrap/thread-workspace-actions";
import { createWorkspaceActivationRouter } from "./bootstrap/workspace-activation-router";
import { resolveWorkspaceInspection } from "./bootstrap/workspace-inspection";
import { createWorkspaceRemovalActions } from "./bootstrap/workspace-removal-actions";
import { createWorkspaceSelectionActions } from "./bootstrap/workspace-selection-actions";
import { createContextSwitchController } from "./context-switch-controller";
import { PiError } from "./effect/errors";
import { runEffectVoid } from "./effect/runtime";
import { GitWorktreeService } from "./git-worktree-service";
import { createSanitizingHandle } from "./ipc/sanitize-ipc-error";
import { registerIpcHandlers } from "./ipc-router";
import { LocalThreadRuntimeManager } from "./local-thread-runtime-manager";
import { PackagesServiceImpl } from "./packages/packages-service-impl";
import { flushAllPersistentJsonFiles } from "./persistent-json-file";
import { RepositoryCatalog } from "./repository-catalog";
import { RepositoryPreferencesCatalog } from "./repository-preferences-catalog";
import { installSecurityHeaders } from "./security/csp";
import { SelectionState } from "./selection-state";
import { terminalManager } from "./terminal-manager";
import { ThreadCatalog, type ThreadCatalogEntry } from "./thread-catalog";
import { createThreadRuntimeLaunchDetails } from "./thread-runtime-launch";
import { shouldQuitWhenAllWindowsClosed } from "./window-config";
import { WorkspaceSearchService } from "./workspace-search-service";
import { WorkspaceSessionCatalog } from "./workspace-session-catalog";

let mainWindow: BrowserWindow | null = null;

const AGENT_BOOTSTRAP_ERROR_SESSION_ID = "bootstrap-error";
const NON_REPOSITORY_WORKSPACE_MESSAGE =
  "This folder is open, but it is not a git repository.";

type AgentDesktopHost = {
  getProviders(): Promise<ProviderSnapshot[]>;
  getSettings(): Promise<SettingsSnapshot>;
  getSnapshot(): Promise<AgentSnapshot>;
  switchModel(request: ModelSwitchRequest): Promise<void>;
  prompt(text: string): Promise<void>;
  cancelPrompt(): Promise<void>;
  reset(): Promise<void>;
  subscribe(listener: (event: PiDesktopAgentEvent) => void): () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readImportedAiPreferences(value: unknown):
  | {
      provider?: string;
      model?: string;
    }
  | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const provider =
    typeof value.provider === "string" ? value.provider : undefined;
  const model = typeof value.model === "string" ? value.model : undefined;

  if (provider === undefined && model === undefined) {
    return undefined;
  }

  return {
    ...(provider === undefined ? {} : { provider }),
    ...(model === undefined ? {} : { model }),
  };
}

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
    async switchModel() {
      throw new Error(message);
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

function getEventTimestamp(event: PiDesktopAgentEvent): number | null {
  return "timestamp" in event && typeof event.timestamp === "number"
    ? event.timestamp
    : null;
}

async function bootstrapDesktop() {
  app.name = "Pi Desktop";
  app.setName("Pi Desktop");
  await app.whenReady();

  installSecurityHeaders({
    session: session.defaultSession,
    isDevelopment: process.env.ELECTRON_RENDERER_URL !== undefined,
  });

  const isMac = process.platform === "darwin";
  installApplicationMenu({
    app,
    menu: Menu,
    dialog,
    isMac,
    existsSync,
    rmSync,
    runEffectVoid,
  });

  const explicitUserDataPath = process.env.PI_DESKTOP_USER_DATA_DIR;
  if (explicitUserDataPath) {
    app.setPath("userData", explicitUserDataPath);
  } else if (process.env.NODE_ENV === "test") {
    const testHomePath = process.env.HOME ?? app.getPath("home");
    app.setPath(
      "userData",
      path.join(testHomePath, ".pi-desktop-test-user-data"),
    );
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
  const oauthPromptBridge = createOAuthPromptBridge({
    getMainWindow: () => mainWindow,
    openExternal: async (url) => {
      await shell.openExternal(url);
    },
  });
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
          agentDir: environment.PI_DESKTOP_AGENT_DIR || defaultAgentDirectory,
        };
      },
      createLaunchDetails: (input) =>
        createThreadRuntimeLaunchDetails({
          ...input,
          agentDirectory: input.agentDirectory ?? undefined,
        }),
    });
  }

  const {
    resolveDefaultThreadContext,
    createWorktreeContext,
    buildFastThreadContext,
    attachContext,
    attachToPath,
  } = createThreadContextActions<AgentDesktopHost, AgentHostSocketTransport>({
    inspectWorktreeOrThrow,
    upsertRepository: (input) => repositoryCatalog.upsert(input),
    getRepository: (repositoryId) => repositoryCatalog.get(repositoryId),
    setLastSelectedWorktree: (repositoryId, worktreeId) =>
      repositoryCatalog.setLastSelectedWorktree(repositoryId, worktreeId),
    replaceSelection: (selection) => selectionState.replace(selection),
    listThreadsByWorktree: (worktreeId) =>
      threadCatalog.listByWorktree(worktreeId),
    createThread: (input) => threadCatalog.create(input),
    getDefaultThreadTitle,
    buildThreadContext,
    environment: process.env,
    runtimeSocketDirectory,
    execPath: process.execPath,
    sessionServerEntryPath: agentHostSessionServerEntryPath,
    ensureDirectory: mkdirSync,
    resolveRuntimeOptions: (environment, cwd) =>
      resolveAgentRuntimeOptions(environment, cwd),
    createLaunchDetails: (input) =>
      createThreadRuntimeLaunchDetails({
        ...input,
        agentDirectory: input.agentDirectory ?? undefined,
      }),
    getHomePath: () => app.getPath("home"),
    isRepository: (rootPath) => gitService.isRepository(rootPath),
    createWorktree: (input) => gitService.createWorktree(input),
    ensureThreadRuntime: (launchSpec) =>
      runtimeManager.ensureThreadRuntime(launchSpec),
    restartThreadRuntime: (launchSpec) =>
      runtimeManager.restartThreadRuntime(launchSpec),
    connectAgentHost: async (socketPath) =>
      connectAgentHostWithRetry({
        socketPath,
        createHost: createAgentHostClient,
      }),
  });

  const workspaceSelectionActions = createWorkspaceSelectionActions({
    repositoryCatalog,
    selectionState,
    state: {
      get currentContext() {
        return currentContext;
      },
      set currentContext(value) {
        currentContext = value;
      },
      get currentTransport() {
        return currentTransport;
      },
      set currentTransport(value) {
        currentTransport = value;
      },
      get unsubscribe() {
        return unsubscribe;
      },
      set unsubscribe(value) {
        unsubscribe = value;
      },
      get currentHost() {
        return currentHost;
      },
      set currentHost(value) {
        currentHost = value;
      },
    },
    createBootstrapErrorHost,
    notifySessionChanged,
  });
  const { getRepositoryIdForWorktree, selectWorktreeWithoutThread } =
    workspaceSelectionActions;

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

  const agentRuntimeHandlers = createAgentRuntimeHandlers({
    getCurrentContext: () => currentContext,
    getCurrentHost: () => currentHost,
    getSelectionState: () => selectionState.get(),
    defaultAgentDirectory,
    getProcessCwd: () => process.cwd(),
    createSettingsManager: async (worktreePath, agentDirectory) => {
      const { SettingsManager } = await import("@mariozechner/pi-coding-agent");
      return SettingsManager.create(worktreePath, agentDirectory);
    },
    runtimeManager,
    attachContext,
    commitAttachment,
    workspaceSearchService,
    oauthPromptBridge,
    notifySessionChanged,
  });

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
  const {
    preferredWorkspacePath,
    fallbackWorkspacePath,
    shouldPreserveEmptySelection,
  } = resolveInitialWorkspaceTarget({
    selection: preferredSelection,
    repositories: repositoryCatalog.list(),
  });

  await activateInitialWorkspaceSelection({
    preferredWorkspacePath,
    fallbackWorkspacePath,
    shouldPreserveEmptySelection,
    state: {
      get currentHost() {
        return currentHost;
      },
      set currentHost(value) {
        currentHost = value;
      },
      get unsubscribe() {
        return unsubscribe;
      },
      set unsubscribe(value) {
        unsubscribe = value;
      },
    },
    activateWorkspacePath: (targetPath, options) =>
      activateWorkspacePath(targetPath, options),
    createBootstrapErrorHost,
    subscribeToHost: (host, thread) => subscribeToHost(host, thread),
  });

  function switchContextInBackground(context: SelectedThreadContext): void {
    void contextSwitchController.switchContext(async () => context);
  }

  const threadWorkspaceActions = createThreadWorkspaceActions({
    getCurrentWorktreeId: () =>
      currentContext?.worktreePath ?? selectionState.get().worktreeId,
    getRepositoryIdForWorktree,
    upsertRepository: (input) => repositoryCatalog.upsert(input),
    getDefaultThreadTitle,
    createThread: (input) => threadCatalog.create(input),
    getThread: (threadId) => threadCatalog.get(threadId),
    inspectWorktreeOrThrow,
    buildThreadContext: (repositoryId, inspection, thread) =>
      buildThreadContext(repositoryId, inspection, thread),
    buildFastThreadContext,
    switchContextInBackground,
  });

  const workspaceRemovalActions = createWorkspaceRemovalActions({
    getRepository: (repositoryId) => repositoryCatalog.get(repositoryId),
    listRepositories: () => repositoryCatalog.list(),
    inspectRepositoryWorktrees: (repositoryRoot) => {
      const inspection = gitService.inspect(repositoryRoot);
      return inspection.status === "repository" && inspection.worktrees
        ? inspection.worktrees
        : [];
    },
    listThreadsByWorktree: (worktreeId) =>
      threadCatalog.listByWorktree(worktreeId),
    deleteThread: (threadId) => {
      threadCatalog.delete(threadId);
    },
    removeWorkspaceSession: (worktreeId) => {
      workspaceSessionCatalog.remove(worktreeId);
    },
    runBestEffortRemoveWorktree: ({ worktreePath, repositoryRoot }) => {
      runEffectVoid(
        Effect.try({
          try: () =>
            gitService.removeWorktree({
              worktreePath,
              repositoryRoot,
            }),
          catch: () =>
            PiError.of("EGIT_FAILED", "Best-effort worktree removal failed"),
        }).pipe(Effect.catchAll(() => Effect.void)),
      );
    },
    removeRepository: (repositoryId) => {
      repositoryCatalog.remove(repositoryId);
    },
    removeRepositoryPreferences: (repositoryId) => {
      repositoryPreferencesCatalog.remove(repositoryId);
    },
    getSelectedRepositoryId: () =>
      currentContext?.repositoryId ?? selectionState.get().repositoryId,
    clearSelection: () => {
      selectionState.clear();
    },
    notifySessionChanged,
    activateWorkspacePath: (targetPath) => activateWorkspacePath(targetPath),
    getRepositoryIdForWorktree,
    inspectRemainingWorktrees: (repositoryRoot) => {
      const inspection = gitService.inspect(repositoryRoot);
      return inspection.status === "repository" && inspection.worktrees
        ? inspection.worktrees
        : [];
    },
    resolveDefaultThreadContext,
    switchContextInBackground,
    getSelectedWorktreeId: () =>
      currentContext?.worktreePath ?? selectionState.get().worktreeId,
    removeWorktreeFromGit: ({ worktreePath, repositoryRoot }) => {
      gitService.removeWorktree({
        worktreePath,
        repositoryRoot,
      });
    },
  });

  const { activateWorkspacePath, switchRepositoryPath } =
    createWorkspaceActivationRouter<
      {
        context: SelectedThreadContext;
        host: AgentDesktopHost;
        transport: AgentHostSocketTransport;
      },
      AgentDesktopHost,
      SelectedThreadContext
    >({
      inspectPath: (targetPath) => gitService.inspect(targetPath),
      attachToPath,
      commitAttachment,
      selectFolderWorkspace: (
        targetPath,
        message,
        subscribeToHostForSelection,
      ) =>
        workspaceSelectionActions.selectFolderWorkspace(
          targetPath,
          message,
          (host) => subscribeToHostForSelection(host),
        ),
      subscribeToHost: (host) => subscribeToHost(host, null),
      nonRepositoryWorkspaceMessage: NON_REPOSITORY_WORKSPACE_MESSAGE,
      resolveDefaultThreadContext,
      switchContextInBackground,
      upsertRepository: (input) => repositoryCatalog.upsert(input),
      selectWorktreeWithoutThread: (repositoryId, worktreePath) =>
        selectWorktreeWithoutThread(repositoryId, worktreePath),
      notifySessionChanged,
    });

  const shellStateIpc = createShellStateIpcDependencies({
    appName: app.getName(),
    appVersion: app.getVersion(),
    chromeVersion: process.versions.chrome,
    electronVersion: process.versions.electron,
    platform: process.platform,
    env: process.env,
    isPackaged: app.isPackaged,
    preferredWorkspacePath,
    getCurrentHost: () => currentHost,
    getCurrentContext: () => currentContext,
    selectionState,
    repositoryCatalog,
    repositoryPreferencesCatalog,
    workspaceSessionCatalog,
    gitService,
    threadCatalog,
    runtimeManager,
  });

  const agentHost = createAgentIpcHost({
    getCurrentContext: () => currentContext,
    getCurrentHost: () => currentHost,
    getSelectedRepositoryId: () => selectionState.get().repositoryId,
    getSelectedThreadId: () => selectionState.get().threadId,
    threadCatalog,
    notifySessionChanged,
    repositoryCatalog,
    workspaceRemovalActions,
    switchRepositoryPath,
    shellOpenPath: (targetPath) => shell.openPath(targetPath),
    createWorktreeContext,
    switchContextInBackground,
    resolveDefaultThreadContext,
    getRepositoryIdForWorktree,
    selectWorktreeWithoutThread,
    threadWorkspaceActions,
    inspectWorktreeOrThrow,
    buildThreadContext,
  });

  registerIpcHandlers(
    createDesktopIpcHandlerDependencies({
      handle: ipcMain.handle.bind(ipcMain),
      createSanitizingHandle,
      logIpcError: (error) => {
        console.error("[ipc] handler error:", error);
      },
      shellStateIpc,
      agentHost,
      repositoryPreferencesCatalog,
      workspaceSessionCatalog,
      appPreferencesCatalog,
      readImportedAiPreferences,
      isRecord,
      mainWindow: null,
      gitService,
      searchFiles: agentRuntimeHandlers.handleSearchFiles,
      switchModel: agentRuntimeHandlers.handleSwitchModel,
      getOAuthProviders: agentRuntimeHandlers.handleGetOAuthProviders,
      loginWithOAuth: agentRuntimeHandlers.handleLoginWithOAuth,
      logoutOAuth: agentRuntimeHandlers.handleLogoutOAuth,
      getDiscovery: agentRuntimeHandlers.handleGetDiscovery,
      getSlashSuggestions: agentRuntimeHandlers.handleGetSlashSuggestions,
      threadCatalog,
      packagesService,
    }),
  );

  mainWindow = await createAndTrackMainWindow({
    createWindow: createMainWindow,
    setMainWindow: (window) => {
      terminalManager.setMainWindow(window);
    },
    subscribeToFullscreenChanges,
    setStoredMainWindow: (window) => {
      mainWindow = window;
    },
  });

  registerDesktopAppLifecycle({
    app,
    browserWindow: BrowserWindow,
    getMainWindow: () => mainWindow,
    createTrackedMainWindow: async () => {
      mainWindow = await createAndTrackMainWindow({
        createWindow: createMainWindow,
        setMainWindow: (window) => {
          terminalManager.setMainWindow(window);
        },
        subscribeToFullscreenChanges,
        setStoredMainWindow: (window) => {
          mainWindow = window;
        },
      });

      return mainWindow;
    },
    initAutoUpdater,
    terminalManager,
    flushPersistentState: flushAllPersistentJsonFiles,
    unsubscribeHost: () => {
      unsubscribe();
    },
    closeCurrentTransport: () => {
      currentTransport?.close();
    },
    shouldQuitWhenAllWindowsClosed,
    env: process.env,
    platform: process.platform,
    logShutdownError: (error) => {
      console.error("Error during shutdown:", error);
    },
  });
}

bootstrapDesktop().catch((err) => {
  console.error("Fatal error during desktop bootstrap:", err);
  app.quit();
});
