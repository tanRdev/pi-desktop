import { mkdirSync } from "node:fs";
import { type AgentSnapshot, IPC_CHANNELS } from "@pidesk/shared";
import { app, BrowserWindow, ipcMain, utilityProcess } from "electron";
import preloadPath from "../preload/runtime?modulePath";
import { createAgentHostClient } from "./agent-host-client";
import agentHostEntryPath from "./agent-host-entry?modulePath";
import {
  createUnavailableAgentHost,
  prepareAgentRuntimeLaunchOptions,
} from "./agent-host-runtime";
import { registerIpcHandlers } from "./ipc-router";
import { createShellSnapshot } from "./shell-snapshot";
import {
  createMainWindowOptions,
  resolvePreloadTarget,
  resolveRendererTarget,
} from "./window-config";

let mainWindow: BrowserWindow | null = null;
let agentHostChild: Electron.UtilityProcess | null = null;

const AGENT_BOOTSTRAP_ERROR_SESSION_ID = "bootstrap-error";

type AgentDesktopHost = {
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

async function bootstrapAgentHost(): Promise<AgentHostBootstrapResult> {
  const launchOptions = prepareAgentRuntimeLaunchOptions(
    process.env,
    process.cwd(),
    app.getPath("userData"),
    app.isPackaged,
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
      preloadPath: resolvePreloadTarget(
        rendererUrl,
        preloadPath,
        import.meta.url,
      ),
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

  const { child, host, launchOptions } = await bootstrapAgentHost();
  agentHostChild = child;

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
        cwd: launchOptions.cwd,
        agentDir: launchOptions.env.PIDESK_AGENT_DIR,
        agentMode: launchOptions.env.PIDESK_AGENT_MODE,
      }),
    agentHost: {
      getSnapshot: () => host.getSnapshot(),
      prompt: (text) => host.prompt(text),
      reset: () => host.reset?.(),
    },
  });

  const unsubscribe = host.subscribe((event) => {
    mainWindow?.webContents.send(IPC_CHANNELS.agent.event, event);
  });

  app.once("will-quit", () => {
    unsubscribe();
    agentHostChild?.kill();
  });

  mainWindow = await createMainWindow();
  mainWindow.on("closed", () => {
    mainWindow = null;
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
