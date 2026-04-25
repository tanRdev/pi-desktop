import { IPC_CHANNELS } from "@pi-desktop/shared";
import { BrowserWindow, type BrowserWindowConstructorOptions } from "electron";
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

export async function createMainWindowWithDependencies({
  env,
  mainEntryUrl,
  dependencies,
}: CreateMainWindowWithDependenciesInput): Promise<BrowserWindow> {
  const windowOptions = dependencies.createMainWindowOptions({
    preloadPath: dependencies.resolvePreloadTarget(mainEntryUrl),
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
