import type { Command } from "./command-registry";
import { registerCommand } from "./command-registry";

/**
 * Developer-tools commands. Most fire `pi:command:<id>` CustomEvents and
 * leave the heavy lifting to listeners (preload, perf overlay, error boundary,
 * etc.). If no listener is wired, they degrade to a console log so we get
 * visible feedback during development.
 */

const GROUP = "Developer";

function dispatchCommandEvent(id: string, detail?: unknown): boolean {
  if (typeof window === "undefined") return false;
  const event = new CustomEvent(`pi:command:${id}`, { detail });
  return window.dispatchEvent(event);
}

function readStringProp(source: unknown, key: string): string | undefined {
  if (source === null || typeof source !== "object") return undefined;
  const record: Record<string, unknown> = { ...source };
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function getUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent ?? "";
}

function readNestedRecord(source: unknown, key: string): unknown {
  if (source === null || typeof source !== "object") return undefined;
  const record: Record<string, unknown> = { ...source };
  return record[key];
}

function getAppVersion(): string {
  if (typeof window === "undefined") return "unknown";
  const api: unknown = window.piDesktop;
  const direct = readStringProp(api, "version");
  if (direct !== undefined) return direct;
  const app = readNestedRecord(api, "app");
  const nested = readStringProp(app, "version");
  if (nested !== undefined) return nested;
  return "unknown";
}

export const DEV_COMMANDS: ReadonlyArray<Command> = [
  {
    id: "toggle-devtools",
    title: "Toggle DevTools",
    group: GROUP,
    keywords: ["devtools", "inspector", "debug", "developer"],
    run: () => {
      const handled = dispatchCommandEvent("toggle-devtools");
      if (!handled) {
        // eslint-disable-next-line no-console
        console.log("[dev-commands] toggle-devtools dispatched");
      }
    },
  },
  {
    id: "reload-renderer",
    title: "Reload Renderer",
    group: GROUP,
    keywords: ["reload", "renderer", "refresh"],
    run: () => {
      if (typeof window === "undefined") return;
      window.location.reload();
    },
  },
  {
    id: "copy-user-agent",
    title: "Copy User Agent",
    group: GROUP,
    keywords: ["copy", "user", "agent", "ua", "browser"],
    run: () => {
      const ua = getUserAgent();
      void copyToClipboard(ua).then((copied) => {
        dispatchCommandEvent("copy-user-agent", { ua, copied });
      });
    },
  },
  {
    id: "copy-app-version",
    title: "Copy App Version",
    group: GROUP,
    keywords: ["copy", "version", "about"],
    run: () => {
      const version = getAppVersion();
      void copyToClipboard(version).then((copied) => {
        dispatchCommandEvent("copy-app-version", { version, copied });
      });
    },
  },
  {
    id: "show-logs",
    title: "Show Recent Logs",
    group: GROUP,
    keywords: ["logs", "console", "history", "debug"],
    run: () => {
      // TODO: hook listener to surface a log viewer panel.
      dispatchCommandEvent("show-logs");
    },
  },
  {
    id: "toggle-perf-overlay",
    title: "Toggle Perf Overlay",
    group: GROUP,
    keywords: ["performance", "overlay", "fps", "metrics", "debug"],
    run: () => {
      // Listened to by the perf overlay (B10).
      dispatchCommandEvent("toggle-perf-overlay");
    },
  },
  {
    id: "trigger-crash",
    title: "Trigger Crash",
    subtitle: "Throws to verify the error boundary",
    group: GROUP,
    keywords: ["crash", "error", "boundary", "debug", "throw"],
    run: () => {
      throw new Error(
        "[dev-commands] Synthetic crash from command palette: trigger-crash",
      );
    },
  },
];

let registered = false;
let disposers: Array<() => void> = [];

/**
 * Install the developer command set. Idempotent — safe to call many times.
 * Returns a teardown function.
 */
export function installDevCommands(): () => void {
  if (registered) {
    return () => undefined;
  }
  registered = true;
  disposers = DEV_COMMANDS.map((c) => registerCommand(c));
  return () => {
    for (const dispose of disposers) dispose();
    disposers = [];
    registered = false;
  };
}

export const __internal = {
  getAppVersion,
  getUserAgent,
  readStringProp,
};
