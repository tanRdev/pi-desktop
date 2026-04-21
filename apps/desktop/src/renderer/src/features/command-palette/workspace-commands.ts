import { zoomManager } from "@/lib/zoom";
import type { Command } from "./command-registry";
import { registerCommand } from "./command-registry";

function dispatchCommandEvent(id: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("pi:command", {
      detail: {
        commandId: id,
        ...(detail != null && typeof detail === "object" ? detail : {}),
      },
    }),
  );
}

export const WORKSPACE_COMMANDS: ReadonlyArray<Command> = [
  {
    id: "workspace-open-folder",
    title: "Open Folder...",
    group: "File",
    keywords: ["open", "folder", "directory", "project", "workspace"],
    run: () => {
      if (typeof window === "undefined") return;
      const dialog: unknown = window.piDesktop?.dialog;
      if (dialog !== null && typeof dialog === "object") {
        const openDirectory: unknown = Reflect.get(dialog, "openDirectory");
        if (typeof openDirectory === "function") {
          void openDirectory();
          return;
        }
      }
      dispatchCommandEvent("open-folder");
    },
  },
  {
    id: "workspace-new-window",
    title: "New Window",
    group: "File",
    shortcut: "⌘⇧N",
    keywords: ["new", "window", "instance"],
    run: () => {
      dispatchCommandEvent("new-window", { commandId: "new-window" });
    },
  },
  {
    id: "workspace-toggle-fullscreen",
    title: "Toggle Full Screen",
    group: "View",
    keywords: ["fullscreen", "full", "screen", "maximize"],
    run: () => {
      dispatchCommandEvent("toggle-fullscreen", {
        commandId: "toggle-fullscreen",
      });
    },
  },
  {
    id: "workspace-zoom-in",
    title: "Zoom In",
    group: "View",
    shortcut: "⌘+",
    keywords: ["zoom", "in", "scale", "magnify"],
    run: () => {
      zoomManager.zoomIn();
    },
  },
  {
    id: "workspace-zoom-out",
    title: "Zoom Out",
    group: "View",
    shortcut: "⌘-",
    keywords: ["zoom", "out", "scale", "shrink"],
    run: () => {
      zoomManager.zoomOut();
    },
  },
  {
    id: "workspace-reset-zoom",
    title: "Reset Zoom",
    group: "View",
    shortcut: "⌘0",
    keywords: ["zoom", "reset", "default", "scale"],
    run: () => {
      zoomManager.resetZoom();
    },
  },
  {
    id: "toggle-sidebar",
    title: "Toggle Sidebar",
    group: "View",
    shortcut: "⌘B",
    keywords: ["sidebar", "panel", "navigation", "toggle"],
    run: () => {
      dispatchCommandEvent("toggle-sidebar");
    },
  },
];

let registered = false;
let disposers: Array<() => void> = [];

export function installWorkspaceCommands(): () => void {
  if (registered) {
    return () => undefined;
  }
  registered = true;
  disposers = WORKSPACE_COMMANDS.map((c) => registerCommand(c));
  return () => {
    for (const dispose of disposers) dispose();
    disposers = [];
    registered = false;
  };
}
