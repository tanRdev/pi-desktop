import { IPC_CHANNELS } from "@pi-desktop/shared";
import {
  app,
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  nativeImage,
} from "electron";
import { resolveAppIconPath } from "../resolve-app-icon";
import {
  createMainWindowOptions,
  hardenMainWindow,
  resolvePreloadTarget,
  resolveRendererTarget,
  shouldDeferWindowShowUntilReady,
  shouldShowMainWindow,
} from "../window-config";

type MainWindowDependencies = {
  BrowserWindow: new (
    options: BrowserWindowConstructorOptions,
  ) => BrowserWindow;
  createMainWindowOptions: typeof createMainWindowOptions;
  resolvePreloadTarget: typeof resolvePreloadTarget;
  hardenMainWindow: typeof hardenMainWindow;
  shouldShowMainWindow: typeof shouldShowMainWindow;
  shouldDeferWindowShowUntilReady: typeof shouldDeferWindowShowUntilReady;
  resolveRendererTarget: typeof resolveRendererTarget;
  resolveAppIconPath?: typeof resolveAppIconPath;
  applyDockIcon?: (iconPath: string) => void;
  appIsPackaged?: boolean;
  resourcesPath?: string;
};

type CreateMainWindowWithDependenciesInput = {
  env: Record<string, string | undefined>;
  mainEntryUrl: string;
  dependencies: MainWindowDependencies;
};

type FullscreenWindow = Pick<
  BrowserWindow,
  "on" | "removeListener" | "isFullScreen" | "webContents"
>;

function applyMacDockIcon(iconPath: string): void {
  if (process.platform !== "darwin" || !app.dock) {
    return;
  }
  const image = nativeImage.createFromPath(iconPath);
  if (!image.isEmpty()) {
    app.dock.setIcon(image);
  }
}

export async function createMainWindowWithDependencies({
  env,
  mainEntryUrl,
  dependencies,
}: CreateMainWindowWithDependenciesInput): Promise<BrowserWindow> {
  const resolveIcon = dependencies.resolveAppIconPath ?? resolveAppIconPath;
  const iconPath = resolveIcon(
    dependencies.appIsPackaged ?? app.isPackaged,
    dependencies.resourcesPath ?? process.resourcesPath,
    mainEntryUrl,
  );

  if (iconPath) {
    (dependencies.applyDockIcon ?? applyMacDockIcon)(iconPath);
  }

  const windowOptions = dependencies.createMainWindowOptions({
    preloadPath: dependencies.resolvePreloadTarget(mainEntryUrl),
    iconPath,
  });
  const window = new dependencies.BrowserWindow(windowOptions);
  dependencies.hardenMainWindow(window);

  if (dependencies.shouldShowMainWindow(env)) {
    const showWindow = () => {
      window.show();
    };

    if (dependencies.shouldDeferWindowShowUntilReady(windowOptions)) {
      window.once("ready-to-show", showWindow);
    } else {
      showWindow();
    }
  }

  const rendererTarget = dependencies.resolveRendererTarget(
    env.ELECTRON_RENDERER_URL,
    mainEntryUrl,
  );

  if (rendererTarget.kind === "url") {
    await window.loadURL(rendererTarget.value);
  } else {
    await window.loadFile(rendererTarget.value);
  }

  return window;
}

export async function createMainWindow(): Promise<BrowserWindow> {
  return createMainWindowWithDependencies({
    env: process.env,
    mainEntryUrl: import.meta.url,
    dependencies: {
      BrowserWindow,
      createMainWindowOptions,
      resolvePreloadTarget,
      hardenMainWindow,
      shouldShowMainWindow,
      shouldDeferWindowShowUntilReady,
      resolveRendererTarget,
    },
  });
}

export function subscribeToFullscreenChanges(window: FullscreenWindow) {
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
