import { globalShortcutRegistry } from "@/lib/keyboard";
import type { Command } from "./command-registry";
import { registerCommand } from "./command-registry";
import { installContextCommands } from "./context-commands";
import { installDevCommands } from "./dev-commands";
import { installFileCommands } from "./file-commands";
import { installGitCommands } from "./git-commands";
import { installWorkspaceCommands } from "./workspace-commands";

/**
 * Default commands fire lightweight custom events on `window`, so other parts
 * of the app can opt in without the palette needing to know about stores.
 *
 * Event names are stable: `pi:command:<id>`.
 */

export type ThemeMode = "light" | "dark" | "auto";

const THEME_STORAGE_KEY = "pi-desktop:theme";

function dispatchCommandEvent(id: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`pi:command:${id}`, { detail }));
}

function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = mode;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // ignore storage failures (private mode etc.)
    }
  }
  dispatchCommandEvent("switch-theme", { mode });
}

function currentTheme(): ThemeMode {
  if (typeof document === "undefined") return "auto";
  const value = document.documentElement.dataset.theme;
  if (value === "light" || value === "dark" || value === "auto") return value;
  return "auto";
}

function nextTheme(mode: ThemeMode): ThemeMode {
  if (mode === "light") return "dark";
  if (mode === "dark") return "auto";
  return "light";
}

async function copyPath(): Promise<void> {
  if (typeof window === "undefined") return;
  const path = window.location?.pathname ?? "";
  if (!navigator?.clipboard?.writeText) {
    dispatchCommandEvent("copy-path", { path, copied: false });
    return;
  }
  try {
    await navigator.clipboard.writeText(path);
    dispatchCommandEvent("copy-path", { path, copied: true });
  } catch {
    dispatchCommandEvent("copy-path", { path, copied: false });
  }
}

function focusPrompt(): void {
  if (typeof document === "undefined") return;
  const el =
    document.querySelector<HTMLElement>("[data-prompt-input]") ??
    document.querySelector<HTMLElement>(
      "textarea[data-testid='prompt-input']",
    ) ??
    document.querySelector<HTMLElement>("textarea");
  if (el) {
    el.focus();
    dispatchCommandEvent("focus-prompt", { focused: true });
  } else {
    dispatchCommandEvent("focus-prompt", { focused: false });
  }
}

function reloadWindow(): void {
  if (typeof window === "undefined") return;
  // Prefer Electron-style reload if available, else fallback to location.reload.
  window.location.reload();
}

export const DEFAULT_COMMANDS: ReadonlyArray<Command> = [
  {
    id: "toggle-sidebar",
    title: "Toggle Sidebar",
    group: "View",
    shortcut: "⌘B",
    keywords: ["sidebar", "panel", "navigation"],
    run: () => {
      dispatchCommandEvent("toggle-sidebar");
    },
  },
  {
    id: "new-thread",
    title: "New Thread",
    group: "File",
    shortcut: "⌘N",
    keywords: ["thread", "conversation", "chat", "create"],
    run: () => {
      dispatchCommandEvent("new-thread");
    },
  },
  {
    id: "reload-window",
    title: "Reload Window",
    group: "View",
    shortcut: "⌘R",
    keywords: ["refresh", "reload"],
    run: () => {
      reloadWindow();
    },
  },
  {
    id: "open-settings",
    title: "Open Settings",
    group: "Preferences",
    shortcut: "⌘,",
    keywords: ["preferences", "config", "settings"],
    run: () => {
      dispatchCommandEvent("open-settings");
    },
  },
  {
    id: "switch-theme",
    title: "Switch Theme",
    subtitle: "Cycle light / dark / auto",
    group: "Preferences",
    keywords: ["theme", "appearance", "dark", "light"],
    run: () => {
      const next = nextTheme(currentTheme());
      applyTheme(next);
    },
  },
  {
    id: "copy-path",
    title: "Copy Path",
    group: "Edit",
    keywords: ["copy", "path", "clipboard", "location"],
    run: () => {
      void copyPath();
    },
  },
  {
    id: "focus-prompt",
    title: "Focus Prompt",
    group: "View",
    shortcut: "⌘L",
    keywords: ["focus", "prompt", "input", "compose"],
    run: () => {
      focusPrompt();
    },
  },
  {
    id: "undo",
    title: "Undo",
    group: "Edit",
    shortcut: "⌘Z",
    keywords: ["undo", "revert"],
    run: () => {
      dispatchCommandEvent("undo");
    },
  },
  {
    id: "redo",
    title: "Redo",
    group: "Edit",
    shortcut: "⌘⇧Z",
    keywords: ["redo", "repeat"],
    run: () => {
      dispatchCommandEvent("redo");
    },
  },
];

/**
 * Map of command id → keyboard registry combo. Only commands that should be
 * globally bound and discoverable in the help overlay are listed here.
 *
 * NOTE: `open-settings` is intentionally omitted — `SettingsHost` owns the
 * `Mod+,` binding via `settings.open` to avoid a duplicate registration.
 */
const COMMAND_KEYBOARD_BINDINGS: ReadonlyArray<{
  id: string;
  keys: string | string[];
  description: string;
  group: string;
}> = [
  {
    id: "toggle-sidebar",
    keys: "Mod+B",
    description: "Toggle sidebar",
    group: "View",
  },
  {
    id: "new-thread",
    keys: "Mod+N",
    description: "New thread",
    group: "File",
  },
  {
    id: "focus-prompt",
    keys: "Mod+L",
    description: "Focus prompt",
    group: "View",
  },
];

let registered = false;
let disposers: Array<() => void> = [];

/**
 * Install the default command set. Idempotent — safe to call many times.
 * Returns a teardown function that unregisters everything installed here.
 */
export function installDefaultCommands(): () => void {
  if (registered) {
    return () => undefined;
  }
  registered = true;
  disposers = DEFAULT_COMMANDS.map((c) => registerCommand(c));

  // Namespaced command groups. Each install fn is idempotent and returns
  // its own teardown which we collect so `installDefaultCommands` cleans
  // them up too.
  disposers.push(installContextCommands());
  disposers.push(installDevCommands());
  disposers.push(installGitCommands());
  disposers.push(installFileCommands());
  disposers.push(installWorkspaceCommands());

  const commandsById = new Map(DEFAULT_COMMANDS.map((c) => [c.id, c]));
  for (const binding of COMMAND_KEYBOARD_BINDINGS) {
    const command = commandsById.get(binding.id);
    if (command === undefined) continue;
    const unregister = globalShortcutRegistry.register({
      id: `command.${binding.id}`,
      keys: binding.keys,
      description: binding.description,
      group: binding.group,
      run: () => {
        void command.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        });
      },
    });
    disposers.push(unregister);
  }

  return () => {
    for (const dispose of disposers) dispose();
    disposers = [];
    registered = false;
  };
}

// Re-exported helpers (used by tests).
export const __internal = {
  applyTheme,
  currentTheme,
  nextTheme,
  focusPrompt,
  copyPath,
};
