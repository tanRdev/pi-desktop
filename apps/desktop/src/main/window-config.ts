import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BrowserWindow,
  BrowserWindowConstructorOptions,
  HandlerDetails,
} from "electron";
import { shell } from "electron";

export interface CreateMainWindowOptionsInput {
  preloadPath: string;
}

export interface RendererTarget {
  kind: "file" | "url";
  value: string;
}

export function shouldShowMainWindow(
  env: Record<string, string | undefined>,
): boolean {
  return env.PI_DESKTOP_HEADLESS !== "1";
}

export function shouldQuitWhenAllWindowsClosed(
  env: Record<string, string | undefined>,
  platform: NodeJS.Platform,
): boolean {
  return platform !== "darwin" || env.PI_DESKTOP_HEADLESS === "1";
}

export function shouldOpenDevTools(
  env: Record<string, string | undefined>,
  isPackaged: boolean,
): boolean {
  return (
    !isPackaged && env.NODE_ENV !== "test" && env.PI_DESKTOP_HEADLESS !== "1"
  );
}

export function shouldDeferWindowShowUntilReady(options: {
  show?: boolean;
  paintWhenInitiallyHidden?: boolean;
}): boolean {
  return options.show === false && options.paintWhenInitiallyHidden !== false;
}

export function createMainWindowOptions({
  preloadPath,
}: CreateMainWindowOptionsInput): BrowserWindowConstructorOptions {
  return {
    title: "Pi Desktop",
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    show: false,
    backgroundColor: "#0a0a0a",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 20, y: 12 },
    roundedCorners: true,
    paintWhenInitiallyHidden: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  };
}

export function shouldAllowNavigation(targetUrl: string): boolean {
  if (!URL.canParse(targetUrl)) {
    return false;
  }

  const parsed = new URL(targetUrl);

  if (parsed.protocol === "file:") {
    return true;
  }

  // Dev server: electron-vite serves the renderer from
  // http://localhost or http://127.0.0.1. We accept those for in-page
  // navigation only when ELECTRON_RENDERER_URL is set (dev mode).
  if (
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
    process.env.ELECTRON_RENDERER_URL !== undefined
  ) {
    return true;
  }

  return false;
}

export type WindowOpenDecision =
  | { kind: "deny" }
  | { kind: "external"; url: string }
  | { kind: "allow" };

export function classifyWindowOpen(
  details: HandlerDetails,
): WindowOpenDecision {
  if (!URL.canParse(details.url)) {
    return { kind: "deny" };
  }

  const parsed = new URL(details.url);

  // Open http(s) URLs in the user's default browser.
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    return { kind: "external", url: parsed.toString() };
  }

  if (shouldAllowNavigation(details.url)) {
    return { kind: "allow" };
  }

  return { kind: "deny" };
}

/**
 * Retained for backwards compatibility with existing tests.
 */
export function shouldDenyWindowOpen(details: HandlerDetails): boolean {
  return classifyWindowOpen(details).kind === "deny";
}

export function hardenMainWindow(window: BrowserWindow): void {
  const session = window.webContents.session;

  session.setPermissionCheckHandler(() => false);
  session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  window.webContents.setWindowOpenHandler((details) => {
    const decision = classifyWindowOpen(details);

    if (decision.kind === "external") {
      void shell.openExternal(decision.url);
      return { action: "deny" };
    }

    if (decision.kind === "allow") {
      return { action: "allow" };
    }

    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, targetUrl) => {
    if (shouldAllowNavigation(targetUrl)) {
      return;
    }

    event.preventDefault();

    if (URL.canParse(targetUrl)) {
      const parsed = new URL(targetUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        void shell.openExternal(parsed.toString());
      }
    }
  });
}

export function resolveRendererTarget(
  rendererUrl: string | undefined,
  mainEntryUrl: string,
): RendererTarget {
  if (rendererUrl) {
    const parsedUrl = new URL(rendererUrl);
    if (
      parsedUrl.protocol !== "http:" ||
      (parsedUrl.hostname !== "127.0.0.1" && parsedUrl.hostname !== "localhost")
    ) {
      throw new Error(
        "ELECTRON_RENDERER_URL must target a local http dev server",
      );
    }

    return {
      kind: "url",
      value: parsedUrl.toString(),
    };
  }

  const mainEntryPath = fileURLToPath(mainEntryUrl);
  const outDirectory = path.dirname(path.dirname(mainEntryPath));

  return {
    kind: "file",
    value: path.join(outDirectory, "renderer", "index.html"),
  };
}

export function resolvePreloadTarget(mainEntryUrl: string): string {
  const mainEntryPath = fileURLToPath(mainEntryUrl);
  const outDirectory = path.dirname(path.dirname(mainEntryPath));

  return path.join(outDirectory, "preload", "index.cjs");
}
