import { mkdirSync } from "node:fs";
import {
  type AgentSnapshot,
  IPC_CHANNELS,
  type ProviderSnapshot,
  type SettingsSnapshot,
} from "@pidesk/shared";
import { app, BrowserWindow, ipcMain, utilityProcess } from "electron";
import { createAgentHostClient } from "./agent-host-client";

import agentHostEntryPath from "./agent-host-entry?modulePath";
import {
  createUnavailableAgentHost,
  prepareAgentRuntimeLaunchOptions,
} from "./agent-host-runtime";
import { registerIpcHandlers } from "./ipc-router";
import { createShellSnapshot } from "./shell-snapshot";
import { terminalManager } from "./terminal-manager";
import {
  createMainWindowOptions,
  resolvePreloadTarget,
  resolveRendererTarget,
} from "./window-config";

let mainWindow: BrowserWindow | null = null;
let agentHostChild: Electron.UtilityProcess | null = null;

const AGENT_BOOTSTRAP_ERROR_SESSION_ID = "bootstrap-error";

type AgentDesktopHost = {
  getProviders(): Promise<ProviderSnapshot[]>;
  getSettings(): Promise<SettingsSnapshot>;
  getSnapshot(): Promise<AgentSnapshot>;
  prompt(text: string): Promise<void>;
  reset(): Promise<void>;
  subscribe(listener: (event: unknown) => void): () => void;
};

type AgentHostBootstrapResult = {
  child: Electron.UtilityProcess;
  host: AgentDesktopHost;
  launchOptions: ReturnType<typeof prepareAgentRuntimeLaunchOptions>;
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
      // no-op for unavailable host
      return Promise.resolve();
    },
    subscribe() {
      return () => {};
    },
  };
}

async function bootstrapAgentHost(
  cwd: string = process.cwd(),
): Promise<AgentHostBootstrapResult> {
  const launchOptions = prepareAgentRuntimeLaunchOptions(
    process.env,
    cwd,
    app.getPath("userData"),
    app.isPackaged,
    app.getPath("home"),
    (directory) => {
      mkdirSync(directory, { recursive: true });
    },
  );
  const child = utilityProcess.fork(agentHostEntryPath, [], {
    cwd: launchOptions.cwd,
    env: launchOptions.env,
    serviceName: "PiDesk Agent Host",
  });
  const client = createAgentHostClient(child);

  try {
    await client.bootstrap();

    return { child, host: client, launchOptions };
  } catch (error) {
    child.kill();

    return {
      child,
      host: createBootstrapErrorHost(
        error instanceof Error ? error.message : "Unknown agent host error",
      ),
      launchOptions,
    };
  }
}

async function createMainWindow() {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;

  const window = new BrowserWindow(
    createMainWindowOptions({
      preloadPath: resolvePreloadTarget(import.meta.url),
    }),
  );

  window.once("ready-to-show", () => {
    window.show();
  });

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

  // Create window FIRST so user sees something immediately
  mainWindow = await createMainWindow();
  terminalManager.setMainWindow(mainWindow);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Bootstrap agent host AFTER window is visible
  const { child, host, launchOptions } = await bootstrapAgentHost();
  agentHostChild = child;

  let currentHost = host;
  let currentLaunchOptions = launchOptions;
  let unsubscribe = currentHost.subscribe((event) => {
    mainWindow?.webContents.send(IPC_CHANNELS.agent.event, event);
  });

  registerIpcHandlers({
    handle: ipcMain.handle.bind(ipcMain),
    getShellSnapshot: () =>
      createShellSnapshot({
        appName: app.getName(),
        appVersion: app.getVersion(),
        chromeVersion: process.versions.chrome,
        electronVersion: process.versions.electron,
        platform: process.platform,
        env: process.env,
        isPackaged: app.isPackaged,
        cwd: currentLaunchOptions.cwd,
        agentDir: currentLaunchOptions.env.PIDESK_AGENT_DIR,
        agentMode: currentLaunchOptions.env.PIDESK_AGENT_MODE,
      }),
    agentHost: {
      getProviders: () => currentHost.getProviders(),
      getSettings: () => currentHost.getSettings(),
      getSnapshot: () => currentHost.getSnapshot(),
      prompt: (text) => currentHost.prompt(text),
      reset: () => currentHost.reset?.(),
      switchWorkspace: async (path) => {
        unsubscribe();
        agentHostChild?.kill();
        const newBootstrap = await bootstrapAgentHost(path);
        agentHostChild = newBootstrap.child;
        currentHost = newBootstrap.host;
        currentLaunchOptions = newBootstrap.launchOptions;
        unsubscribe = currentHost.subscribe((event) => {
          mainWindow?.webContents.send(IPC_CHANNELS.agent.event, event);
        });
        mainWindow?.webContents.send(IPC_CHANNELS.agent.event, {
          type: "agent:reset",
        });
      },
    },
    mainWindow: null,
  });

  app.once("will-quit", () => {
    unsubscribe();
    agentHostChild?.kill();
    terminalManager.destroyAll();
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createMainWindow();
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
