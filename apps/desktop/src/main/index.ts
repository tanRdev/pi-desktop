import { mkdirSync } from "node:fs";
import path from "node:path";
import type {
  AgentSnapshot,
  AutocompleteContext,
  AutocompleteSuggestions,
  ModelSwitchRequest,
  PiDeskAgentEvent,
  PiDiscoveryResult,
  PiTerminalRouteRequest,
  PiTerminalRouteResult,
  ProviderSnapshot,
  SearchRequest,
  SearchResponse,
  SettingsSnapshot,
} from "@pidesk/shared";
import { IPC_CHANNELS } from "@pidesk/shared";
import { app, BrowserWindow, ipcMain } from "electron";
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
import { routePromptToTerminal } from "./bootstrap/route-to-terminal";
import {
  buildThreadContext as buildThreadContextFromHelper,
  type ResolvedRepositoryInspection,
  type SelectedThreadContext,
} from "./bootstrap/thread-context";
import { GitWorktreeService } from "./git-worktree-service";
import { registerIpcHandlers } from "./ipc-router";
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
import { TmuxThreadRuntimeManager } from "./tmux-thread-runtime-manager";
import {
  createMainWindowOptions,
  resolvePreloadTarget,
  resolveRendererTarget,
  shouldShowMainWindow,
} from "./window-config";
import { WorkspaceSearchService } from "./workspace-search-service";
import { WorkspaceSessionCatalog } from "./workspace-session-catalog";

let mainWindow: BrowserWindow | null = null;

const AGENT_BOOTSTRAP_ERROR_SESSION_ID = "bootstrap-error";
const SOCKET_CONNECT_TIMEOUT_MS = 5_000;
const SOCKET_CONNECT_RETRY_MS = 50;

type AgentDesktopHost = {
  getProviders(): Promise<ProviderSnapshot[]>;
  getSettings(): Promise<SettingsSnapshot>;
  getSnapshot(): Promise<AgentSnapshot>;
  prompt(text: string): Promise<void>;
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
    async reset() {
      return Promise.resolve();
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
  const window = new BrowserWindow(
    createMainWindowOptions({
      preloadPath: resolvePreloadTarget(import.meta.url),
    }),
  );

  if (shouldShowMainWindow(process.env)) {
    window.once("ready-to-show", () => {
      window.show();
    });
  }

  const rendererTarget = resolveRendererTarget(rendererUrl, import.meta.url);
  if (rendererTarget.kind === "url") {
    await window.loadURL(rendererTarget.value);
  } else {
    await window.loadFile(rendererTarget.value);
  }

  return window;
}

async function bootstrapDesktop() {
  await app.whenReady();
  app.setName("PiDesk");

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
  const runtimeManager = new TmuxThreadRuntimeManager();
  const runtimeSocketDirectory = path.join(app.getPath("temp"), "pd");
  mkdirSync(runtimeSocketDirectory, { recursive: true });

  let currentContext: SelectedThreadContext | null = null;
  let currentTransport: AgentHostSocketTransport | null = null;
  let currentHost: AgentDesktopHost = createBootstrapErrorHost(
    "PiDesk agent host has not been attached yet",
  );
  const workspaceSearchService = new WorkspaceSearchService();
  const defaultAgentDirectory = path.join(app.getPath("home"), ".pi", "agent");

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

  function resolveAgentDirectory(): string {
    return currentContext?.agentDirectory ?? defaultAgentDirectory;
  }

  function resolveContextCwd(): string {
    return currentContext?.worktreePath ?? process.cwd();
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

  async function handleRouteToTerminal(
    request: PiTerminalRouteRequest,
  ): Promise<PiTerminalRouteResult> {
    return routePromptToTerminal(request, {
      terminalManager,
      delay,
    });
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

    if (
      inspection.status !== "repository" ||
      !inspection.rootPath ||
      !inspection.currentWorktreePath ||
      !inspection.worktrees
    ) {
      throw new Error("Selected directory is not inside a git repository");
    }

    return inspection as ResolvedRepositoryInspection;
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
          agentDir: runtimeOptions.agentDir,
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
    const thread = threadCatalog.ensureOpenThread({
      worktreeId: inspection.currentWorktreePath,
      title: "Current thread",
    });

    return buildThreadContext(repositoryEntry.id, inspection, thread);
  }

  async function resolveRepositoryContext(
    repositoryId: string,
  ): Promise<SelectedThreadContext> {
    const repository = repositoryCatalog.get(repositoryId);
    if (!repository) {
      throw new Error(`Unknown repository: ${repositoryId}`);
    }

    return resolveDefaultThreadContext(
      repository.lastSelectedWorktreeId ?? repository.rootPath,
    );
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
    title?: string,
  ): Promise<SelectedThreadContext> {
    const inspection = inspectWorktreeOrThrow(worktreeId);
    const thread = threadCatalog.create({
      worktreeId: inspection.currentWorktreePath,
      title: title?.trim() || "New thread",
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

  async function attachToRepository(repositoryId: string) {
    return attachContext(await resolveRepositoryContext(repositoryId));
  }

  async function attachToThreadId(threadId: string) {
    return attachContext(await resolveThreadContext(threadId));
  }

  async function createAndAttachThread(worktreeId: string, title?: string) {
    return attachContext(await createThreadContext(worktreeId, title));
  }

  async function createAndAttachWorktree(
    repositoryId: string,
    branchName: string,
  ) {
    return attachContext(await createWorktreeContext(repositoryId, branchName));
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

  const preferredWorktreePath =
    selectionState.get().worktreeId ?? process.cwd();

  try {
    commitAttachment(await attachToPath(preferredWorktreePath));
  } catch (error) {
    const fallbackPath = process.cwd();
    if (preferredWorktreePath !== fallbackPath) {
      try {
        commitAttachment(await attachToPath(fallbackPath));
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

  registerIpcHandlers({
    handle: ipcMain.handle.bind(ipcMain),
    getShellSnapshot: async () => {
      let agentSnapshot: AgentSnapshot | null = null;
      try {
        agentSnapshot = await currentHost.getSnapshot();
      } catch {
        // Preserve shell visibility even when the selected agent runtime is unavailable.
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
        cwd: selection.worktreeId ?? preferredWorktreePath,
        agentDir: currentContext?.agentDirectory ?? undefined,
        agentMode: currentContext?.agentMode,
        agentSnapshot,
        catalog,
      });
    },
    agentHost: {
      getProviders: () => currentHost.getProviders(),
      getSettings: () => currentHost.getSettings(),
      getSnapshot: () => currentHost.getSnapshot(),
      prompt: (text) => currentHost.prompt(text),
      reset: () => currentHost.reset(),
      addRepository: async (targetPath) => {
        commitAttachment(await attachToPath(targetPath));
      },
      selectRepository: async (repositoryId) => {
        commitAttachment(await attachToRepository(repositoryId));
      },
      createWorktree: async (repositoryId, branchName) => {
        commitAttachment(
          await createAndAttachWorktree(repositoryId, branchName),
        );
      },
      selectWorktree: async (worktreeId) => {
        commitAttachment(await attachToPath(worktreeId));
      },
      createThread: async (worktreeId, title) => {
        commitAttachment(await createAndAttachThread(worktreeId, title));
      },
      selectThread: async (threadId) => {
        commitAttachment(await attachToThreadId(threadId));
      },
    },
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
    routeToTerminal: handleRouteToTerminal,
    threadCatalog,
  });

  mainWindow = await createMainWindow();
  terminalManager.setMainWindow(mainWindow);
  mainWindow.on("closed", () => {
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
      mainWindow.on("closed", () => {
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
