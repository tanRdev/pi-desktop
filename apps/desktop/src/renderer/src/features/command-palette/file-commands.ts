import type { Command } from "./command-registry";
import { registerCommand } from "./command-registry";

/**
 * File commands. Dispatch `pi:file:*` events for the file tree / editor to
 * handle. Keeping these palette-side keeps shortcuts discoverable without
 * coupling the palette to file-system state.
 */

const GROUP = "File";

function dispatchFileEvent(suffix: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`pi:file:${suffix}`, { detail }));
}

export const FILE_COMMANDS: ReadonlyArray<Command> = [
  {
    id: "file-new",
    title: "New File",
    group: GROUP,
    keywords: ["file", "new", "create"],
    run: () => {
      dispatchFileEvent("new");
    },
  },
  {
    id: "file-rename",
    title: "Rename File",
    group: GROUP,
    keywords: ["file", "rename", "move"],
    run: () => {
      dispatchFileEvent("rename");
    },
  },
  {
    id: "file-reveal",
    title: "Reveal File in Finder",
    group: GROUP,
    keywords: ["file", "reveal", "finder", "explorer", "show"],
    run: () => {
      dispatchFileEvent("reveal");
    },
  },
];

let registered = false;
let disposers: Array<() => void> = [];

export function installFileCommands(): () => void {
  if (registered) {
    return () => undefined;
  }
  registered = true;
  disposers = FILE_COMMANDS.map((c) => registerCommand(c));
  return () => {
    for (const dispose of disposers) dispose();
    disposers = [];
    registered = false;
  };
}
