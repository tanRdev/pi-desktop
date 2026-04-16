import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import type {
  AgentSnapshot,
  AutocompleteContext,
  AutocompleteSuggestions,
  ModelSwitchRequest,
  PiDesktopAgentEvent,
  PiDiscoveryResult,
  ProviderSnapshot,
  SearchRequest,
  SearchResponse,
  SettingsSnapshot,
} from "@pi-desktop/shared";
import { IPC_CHANNELS } from "@pi-desktop/shared";
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import {
  DEFAULT_UNTITLED_THREAD_TITLE,
  generateThreadTitleFromMessage,
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
import { initAutoUpdater } from "./auto-updater";
import { switchModelForContext } from "./bootstrap/model-switch";
import {
  buildThreadContext as buildThreadContextFromHelper,
  type ResolvedRepositoryInspection,
  type SelectedThreadContext,
} from "./bootstrap/thread-context";
import { resolveWorkspaceInspection } from "./bootstrap/workspace-inspection";
import { createContextSwitchController } from "./context-switch-controller";
import { GitWorktreeService } from "./git-worktree-service";
import { createSanitizingHandle } from "./ipc/sanitize-ipc-error";
import { registerIpcHandlers } from "./ipc-router";
import { LocalThreadRuntimeManager } from "./local-thread-runtime-manager";
import { PackagesServiceImpl } from "./packages/packages-service-impl";
import {
  getOAuthProvidersForAgentDir,
  loginWithOAuthForAgentDir,
  logoutOAuthForAgentDir,
} from "./pi-oauth-service";
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
  shouldQuitWhenAllWindowsClosed,
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getEventTimestamp(event: PiDesktopAgentEvent): number | null {
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

async function promptForOAuthInput(params: {
  providerId: string;
  message: string;
  authUrl?: string;
  verificationUri?: string;
  userCode?: string;
}): Promise<string> {
  if (!mainWindow) {
    throw new Error("Main window is unavailable");
  }

  const detailLines = [
    params.message,
    params.authUrl ? `URL: ${params.authUrl}` : null,
    params.verificationUri ? `Verify at: ${params.verificationUri}` : null,
    params.userCode ? `Code: ${params.userCode}` : null,
  ].filter((value): value is string => Boolean(value));

  const response = await mainWindow.webContents.executeJavaScript(
    `window.prompt(${JSON.stringify(detailLines.join("\n\n"))}, "")`,
    true,
  );

  if (typeof response !== "string") {
    throw new Error(`OAuth input cancelled for ${params.providerId}`);
  }

  return response.trim();
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
  app.name = "Pi Desktop";
  app.setName("Pi Desktop");
  await app.whenReady();

  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" } as Electron.MenuItemConstructorOptions,
              { type: "separator" } as Electron.MenuItemConstructorOptions,
              {
                label: "Uninstall Pi Desktop...",
                click: async () => {
                  const response = await dialog.showMessageBox({
                    type: "warning",
                    buttons: ["Cancel", "Uninstall"],
                    defaultId: 1,
                    title: "Uninstall Pi Desktop",
                    message: "Are you sure you want to uninstall Pi Desktop?",
                    detail:
                      "This will remove the application, your settings, and cached data. This action cannot be undone.",
                  });

                  if (response.response === 1) {
                    try {
                      // Get paths to delete
                      const userDataPath = app.getPath("userData");
                      const appPath = app.getPath("exe"); // Only works well if packaged

                      // Delete user data
                      if (existsSync(userDataPath)) {
                        rmSync(userDataPath, {
                          recursive: true,
                          force: true,
                        });
                      }

                      // If packaged on Mac, delete the .app bundle
                      if (isMac && app.isPackaged) {
                        const appBundlePath = appPath.substring(
                          0,
                          appPath.indexOf(".app") + 4,
                        );
                        if (existsSync(appBundlePath)) {
                          app.relaunch({
                            args: ["--uninstall-script", appBundlePath],
                          });
                          app.quit();
                          return;
                        }
                      }

                      dialog.showMessageBoxSync({
                        message:
                          "Pi Desktop data removed. You can now move the app to Trash.",
                      });
                      app.quit();
                    } catch (err) {
                      dialog.showErrorBox("Uninstall Failed", String(err));
                    }
                  }
                },
              },
              { type: "separator" } as Electron.MenuItemConstructorOptions,
              { role: "services" } as Electron.MenuItemConstructorOptions,
              { type: "separator" } as Electron.MenuItemConstructorOptions,
              { role: "hide" } as Electron.MenuItemConstructorOptions,
              { role: "hideOthers" } as Electron.MenuItemConstructorOptions,
              { role: "unhide" } as Electron.MenuItemConstructorOptions,
              { type: "separator" } as Electron.MenuItemConstructorOptions,
              { role: "quit" } as Electron.MenuItemConstructorOptions,
            ],
          },
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(isMac
          ? [
              { role: "pasteAndMatchStyle" },
              { role: "delete" },
              { role: "selectAll" },
              { type: "separator" },
              {
                label: "Speech",
                submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }],
              },
            ]
          : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]),
      ] as Electron.MenuItemConstructorOptions[],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" },
            ]
          : [{ role: "close" }]),
      ] as Electron.MenuItemConstructorOptions[],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

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
    try {
      await currentHost.switchModel(request);
      notifySessionChanged();
      return;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message !==
          "Model switching is not supported by the active Pi runtime"
      ) {
        throw error;
      }
    }

    await switchModelForContext(request, {
      currentContext,
      currentHost,
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

  async function handleGetOAuthProviders() {
    return getOAuthProvidersForAgentDir(resolveAgentDirectory());
  }

  async function handleLoginWithOAuth(providerId: string): Promise<void> {
    await loginWithOAuthForAgentDir(resolveAgentDirectory(), providerId, {
      openExternal: async (url) => {
        await shell.openExternal(url);
      },
      requestInput: promptForOAuthInput,
    });
    notifySessionChanged();
  }

  async function handleLogoutOAuth(providerId: string): Promise<void> {
    await logoutOAuthForAgentDir(resolveAgentDirectory(), providerId);
    notifySessionChanged();
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

  async function resolveDefaultThreadContext(
    targetPath: string,
    options: { createIfMissing?: boolean } = {},
  ): Promise<SelectedThreadContext | null> {
    const inspection = inspectWorktreeOrThrow(targetPath);
    const repositoryEntry = repositoryCatalog.upsert({
      rootPath: inspection.rootPath,
    });
    const thread = threadCatalog.listByWorktree(
      inspection.currentWorktreePath,
    )[0];

    if (!thread && options.createIfMissing === false) {
      repositoryCatalog.setLastSelectedWorktree(
        repositoryEntry.id,
        inspection.currentWorktreePath,
      );
      selectionState.replace({
        repositoryId: repositoryEntry.id,
        worktreeId: inspection.currentWorktreePath,
        threadId: null,
      });
      return null;
    }

    const resolvedThread =
      thread ??
      threadCatalog.create({
        worktreeId: inspection.currentWorktreePath,
        title: getDefaultThreadTitle(),
      });

    return buildThreadContext(repositoryEntry.id, inspection, resolvedThread);
  }

  async function createWorktreeContext(
    repositoryId: string,
    branchName: string,
  ): Promise<SelectedThreadContext | null> {
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
      ".pi-desktop",
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
    const thread = threadCatalog.create({
      worktreeId: inspection.currentWorktreePath,
      title: getDefaultThreadTitle(),
    });
    const repositoryEntry = repositoryCatalog.upsert({
      rootPath: inspection.rootPath,
    });

    return buildThreadContext(repositoryEntry.id, inspection, thread);
  }

  function getRepositoryIdForWorktree(worktreeId: string): string | null {
    const normalizedWorktreeId = path
      .resolve(worktreeId)
      .replace(/[\\/]+$/, "");

    for (const repository of repositoryCatalog.list()) {
      if (
        normalizedWorktreeId === repository.rootPath ||
        normalizedWorktreeId.startsWith(`${repository.rootPath}${path.sep}`)
      ) {
        return repository.id;
      }
    }

    return currentContext?.repositoryId ?? selectionState.get().repositoryId;
  }

  function buildFastThreadContext(options: {
    repositoryId: string;
    worktreePath: string;
    thread: ThreadCatalogEntry;
  }): SelectedThreadContext {
    const runtimeOptions = resolveAgentRuntimeOptions(
      process.env,
      options.worktreePath,
    );

    if (runtimeOptions.agentDir) {
      mkdirSync(runtimeOptions.agentDir, { recursive: true });
    }

    const launch = createThreadRuntimeLaunchDetails({
      threadId: options.thread.id,
      worktreePath: options.worktreePath,
      mode: runtimeOptions.mode,
      socketDirectory: runtimeSocketDirectory,
      execPath: process.execPath,
      sessionServerEntryPath: agentHostSessionServerEntryPath,
      nodeEnv: process.env.NODE_ENV,
      agentDirectory: runtimeOptions.agentDir ?? undefined,
    });

    repositoryCatalog.setLastSelectedWorktree(
      options.repositoryId,
      options.worktreePath,
    );
    selectionState.replace({
      repositoryId: options.repositoryId,
      worktreeId: options.worktreePath,
      threadId: options.thread.id,
    });

    return {
      repositoryId: options.repositoryId,
      worktreePath: options.worktreePath,
      thread: options.thread,
      socketPath: launch.socketPath,
      runtimeId: launch.runtimeId ?? null,
      command: launch.command,
      agentMode: runtimeOptions.mode,
      agentDirectory: runtimeOptions.agentDir ?? null,
      runtimeAgentDirectory: launch.agentDirectory ?? null,
    };
  }

  function selectWorktreeWithoutThread(
    repositoryId: string | null,
    worktreePath: string,
  ): void {
    if (repositoryId) {
      repositoryCatalog.setLastSelectedWorktree(repositoryId, worktreePath);
    }

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
      worktreeId: worktreePath,
      threadId: null,
    });
    notifySessionChanged();
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

  async function attachToPath(
    targetPath: string,
    options: { createIfMissing?: boolean } = {},
  ) {
    const context = await resolveDefaultThreadContext(targetPath, options);
    if (!context) {
      return null;
    }

    return attachContext(context);
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

  async function activateWorkspacePath(
    targetPath: string,
    options: { createIfMissing?: boolean } = {},
  ): Promise<void> {
    const inspection = gitService.inspect(targetPath);

    if (
      inspection.status === "repository" &&
      inspection.rootPath &&
      inspection.currentWorktreePath &&
      inspection.worktrees
    ) {
      const attached = await attachToPath(targetPath, options);
      if (attached) {
        commitAttachment(attached);
      }
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
  const shouldPreserveEmptySelection =
    preferredSelection.threadId === null &&
    (preferredSelection.worktreeId !== null ||
      preferredSelection.repositoryId !== null);

  try {
    await activateWorkspacePath(preferredWorkspacePath, {
      createIfMissing: !shouldPreserveEmptySelection,
    });
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

  async function switchRepositoryPath(
    targetPath: string,
    options: { createIfMissing?: boolean } = {},
  ): Promise<void> {
    const inspection = gitService.inspect(targetPath);

    if (
      inspection.status === "repository" &&
      inspection.rootPath &&
      inspection.currentWorktreePath &&
      inspection.worktrees
    ) {
      const context = await resolveDefaultThreadContext(targetPath, options);
      if (!context) {
        const repositoryEntry = repositoryCatalog.upsert({
          rootPath: inspection.rootPath,
        });
        selectWorktreeWithoutThread(
          repositoryEntry.id,
          inspection.currentWorktreePath,
        );
        return;
      }

      switchContextInBackground(context);
      return;
    }

    await activateWorkspacePath(targetPath, options);
    if (inspection.status !== "repository") {
      notifySessionChanged();
    }
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
      .find((entry) => entry.id !== threadId);

    if (!nextOpenThread) {
      const repositoryId =
        currentContext?.repositoryId ?? selectionState.get().repositoryId;
      selectWorktreeWithoutThread(repositoryId, thread.worktreeId);
      return;
    }

    switchContextInBackground(await resolveThreadContext(nextOpenThread.id));
  }

  registerIpcHandlers({
    handle: createSanitizingHandle(ipcMain.handle.bind(ipcMain), {
      log: (error) => {
        console.error("[ipc] handler error:", error);
      },
    }),
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
        inspectRepository: (rootPath) => gitService.inspectAsync(rootPath),
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
      prompt: async (text) => {
        const currentThread = currentContext?.thread;
        if (currentThread) {
          // Check if thread still has default "Pi" title
          const threadEntry = threadCatalog.get(currentThread.id);
          if (threadEntry?.title === DEFAULT_UNTITLED_THREAD_TITLE) {
            const newTitle = generateThreadTitleFromMessage(text);
            threadCatalog.rename(currentThread.id, newTitle);
            notifySessionChanged();
          }
        }
        await currentHost.prompt(text);
      },
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
          { createIfMissing: false },
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
        const context = await createWorktreeContext(repositoryId, branchName);
        if (!context) {
          throw new Error(
            "Failed to create a default thread for the new worktree",
          );
        }

        switchContextInBackground(context);
      },
      selectWorktree: async (worktreeId) => {
        const context = await resolveDefaultThreadContext(worktreeId, {
          createIfMissing: false,
        });
        if (!context) {
          const repositoryId = getRepositoryIdForWorktree(worktreeId);
          selectWorktreeWithoutThread(repositoryId, worktreeId);
          return;
        }

        switchContextInBackground(context);
      },
      removeWorktree: async (worktreeId) => {
        const normalizedWorktreeId = path
          .resolve(worktreeId)
          .replace(/[\\/]+$/, "");

        const repositoryId = getRepositoryIdForWorktree(normalizedWorktreeId);
        const repository = repositoryId
          ? repositoryCatalog.get(repositoryId)
          : null;

        if (!repository) {
          throw new Error(`Cannot find repository for worktree: ${worktreeId}`);
        }

        const isActiveWorktree =
          (currentContext?.worktreePath ?? selectionState.get().worktreeId) ===
          normalizedWorktreeId;

        const threadsInWorktree =
          threadCatalog.listByWorktree(normalizedWorktreeId);
        for (const thread of threadsInWorktree) {
          threadCatalog.delete(thread.id);
        }

        gitService.removeWorktree({
          worktreePath: normalizedWorktreeId,
          repositoryRoot: repository.rootPath,
        });

        if (isActiveWorktree) {
          const remainingWorktrees = gitService.inspect(repository.rootPath);
          const nextWorktree =
            remainingWorktrees.status === "repository" &&
            remainingWorktrees.worktrees
              ? remainingWorktrees.worktrees.find(
                  (wt) => wt.path !== normalizedWorktreeId,
                )
              : null;

          if (nextWorktree) {
            const context = await resolveDefaultThreadContext(
              nextWorktree.path,
              {
                createIfMissing: true,
              },
            );
            if (context) {
              switchContextInBackground(context);
              return;
            }
          }

          const remainingRepositories = repositoryCatalog
            .list()
            .filter((r) => r.id !== repositoryId);
          const nextRepo = remainingRepositories[0];
          if (nextRepo) {
            await activateWorkspacePath(
              nextRepo.lastSelectedWorktreeId ?? nextRepo.rootPath,
            );
          } else {
            selectionState.clear();
          }
        }

        notifySessionChanged();
      },
      createThread: async (worktreeId) => {
        const normalizedWorktreeId = path
          .resolve(worktreeId)
          .replace(/[\\/]+$/, "");
        const isCurrentWorktree =
          normalizedWorktreeId ===
          (currentContext?.worktreePath ?? selectionState.get().worktreeId);
        const context = isCurrentWorktree
          ? buildFastThreadContext({
              repositoryId:
                getRepositoryIdForWorktree(normalizedWorktreeId) ??
                repositoryCatalog.upsert({ rootPath: normalizedWorktreeId }).id,
              worktreePath: normalizedWorktreeId,
              thread: threadCatalog.create({
                worktreeId: normalizedWorktreeId,
                title: getDefaultThreadTitle(),
              }),
            })
          : await createThreadContext(normalizedWorktreeId);
        switchContextInBackground(context);
        return context.thread.id;
      },
      selectThread: async (threadId) => {
        const thread = threadCatalog.get(threadId);
        if (!thread) {
          throw new Error(`Unknown thread: ${threadId}`);
        }
        switchContextInBackground(
          thread.worktreeId ===
            (currentContext?.worktreePath ?? selectionState.get().worktreeId)
            ? buildFastThreadContext({
                repositoryId:
                  getRepositoryIdForWorktree(thread.worktreeId) ??
                  repositoryCatalog.upsert({ rootPath: thread.worktreeId }).id,
                worktreePath: thread.worktreeId,
                thread,
              })
            : await resolveThreadContext(threadId),
        );
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
    },
    mainWindow: null,
    searchFiles: handleSearchFiles,
    switchModel: handleSwitchModel,
    getOAuthProviders: handleGetOAuthProviders,
    loginWithOAuth: handleLoginWithOAuth,
    logoutOAuth: handleLogoutOAuth,
    getDiscovery: handleGetDiscovery,
    getSlashSuggestions: handleGetSlashSuggestions,
    threadCatalog,
    packagesService,
    getAllowedRepositoryRoots: () =>
      repositoryCatalog.list().map((entry) => entry.rootPath),
    getAllowedTerminalCwds: () => {
      const roots: string[] = [];
      for (const entry of repositoryCatalog.list()) {
        roots.push(entry.rootPath);
        const inspection = gitService.inspect(entry.rootPath);
        if (inspection.worktrees) {
          for (const worktree of inspection.worktrees) {
            roots.push(worktree.path);
          }
        }
      }
      return roots;
    },
  });

  mainWindow = await createMainWindow();
  terminalManager.setMainWindow(mainWindow);
  let unsubscribeFullscreen = subscribeToFullscreenChanges(mainWindow);

  if (app.isPackaged) {
    initAutoUpdater();
  }
  mainWindow.on("closed", () => {
    unsubscribeFullscreen();
    mainWindow = null;
  });

  app.once("will-quit", (event) => {
    unsubscribe();
    currentTransport?.close();
    event.preventDefault();
    terminalManager
      .destroyAllAsync()
      .catch((err) => {
        console.error("Error destroying terminals on quit:", err);
      })
      .finally(() => {
        app.exit(0);
      });
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
    if (shouldQuitWhenAllWindowsClosed(process.env, process.platform)) {
      app.quit();
    }
  });
}

bootstrapDesktop().catch((err) => {
  console.error("Fatal error during desktop bootstrap:", err);
  app.quit();
});
