import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserWindowConstructorOptions } from "electron";

export interface CreateMainWindowOptionsInput {
  preloadPath: string;
}

export interface RendererTarget {
  kind: "file" | "url";
  value: string;
}

export function createMainWindowOptions({
  preloadPath,
}: CreateMainWindowOptionsInput): BrowserWindowConstructorOptions {
  return {
    title: "PiDesk",
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    show: false,
    backgroundColor: "#0a0a0a",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 20, y: 18 },
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      webSecurity: true,
    },
  };
}

export function resolveRendererTarget(
  rendererUrl: string | undefined,
  mainEntryUrl: string,
): RendererTarget {
  if (rendererUrl) {
    return {
      kind: "url",
      value: rendererUrl,
    };
  }

  const mainEntryPath = fileURLToPath(mainEntryUrl);
  const outDirectory = path.dirname(path.dirname(mainEntryPath));

  return {
    kind: "file",
    value: path.join(outDirectory, "renderer", "index.html"),
  };
}

export function resolvePreloadTarget(
  rendererUrl: string | undefined,
  preloadModulePath: string,
  mainEntryUrl: string,
): string {
  if (rendererUrl) {
    return preloadModulePath;
  }

  const mainEntryPath = fileURLToPath(mainEntryUrl);
  const outDirectory = path.dirname(path.dirname(mainEntryPath));

  return path.join(outDirectory, "preload", "index.cjs");
}
