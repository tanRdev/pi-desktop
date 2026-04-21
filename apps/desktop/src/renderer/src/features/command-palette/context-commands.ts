import type { Command } from "./command-registry";
import { registerCommand } from "./command-registry";

/**
 * Context-aware commands that appear based on the current UI context.
 *
 * Each command has a `when` predicate that reads from a pluggable context
 * source. By default they read `window.__piCommandContext`, which other
 * parts of the app populate. This keeps the palette decoupled from stores
 * while still providing context-sensitive commands.
 */

export interface PiCommandContext {
  readonly hasFocusedEditorFile: boolean;
  readonly hasActiveThread: boolean;
  readonly hasFocusedTerminal: boolean;
}

declare global {
  interface Window {
    __piCommandContext?: PiCommandContext;
  }
}

function context(): PiCommandContext {
  if (typeof window === "undefined") return defaultContext();
  return window.__piCommandContext ?? defaultContext();
}

function defaultContext(): PiCommandContext {
  return {
    hasFocusedEditorFile: false,
    hasActiveThread: false,
    hasFocusedTerminal: false,
  };
}

function dispatchContextEvent(suffix: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`pi:context:${suffix}`, { detail }));
}

export const CONTEXT_COMMANDS: ReadonlyArray<Command> = [
  {
    id: "editor-close-file",
    title: "Close File",
    group: "Editor",
    keywords: ["close", "file", "editor"],
    when: () => context().hasFocusedEditorFile,
    run: () => {
      dispatchContextEvent("close-file");
    },
  },
  {
    id: "editor-save-file",
    title: "Save File",
    group: "Editor",
    shortcut: "⌘S",
    keywords: ["save", "file", "editor"],
    when: () => context().hasFocusedEditorFile,
    run: () => {
      dispatchContextEvent("save-file");
    },
  },
  {
    id: "editor-reveal-in-tree",
    title: "Reveal in Tree",
    group: "Editor",
    keywords: ["reveal", "tree", "file", "sidebar", "locate"],
    when: () => context().hasFocusedEditorFile,
    run: () => {
      dispatchContextEvent("reveal-in-tree");
    },
  },
  {
    id: "thread-archive",
    title: "Archive Thread",
    group: "Thread",
    keywords: ["archive", "thread", "conversation"],
    when: () => context().hasActiveThread,
    run: () => {
      dispatchContextEvent("archive-thread");
    },
  },
  {
    id: "thread-rename",
    title: "Rename Thread",
    group: "Thread",
    keywords: ["rename", "thread", "title", "name"],
    when: () => context().hasActiveThread,
    run: () => {
      dispatchContextEvent("rename-thread");
    },
  },
  {
    id: "thread-share-transcript",
    title: "Share Transcript",
    group: "Thread",
    keywords: ["share", "transcript", "export", "thread"],
    when: () => context().hasActiveThread,
    run: () => {
      dispatchContextEvent("share-transcript");
    },
  },
  {
    id: "terminal-clear",
    title: "Clear Terminal",
    group: "Terminal",
    keywords: ["clear", "terminal", "console", "reset"],
    when: () => context().hasFocusedTerminal,
    run: () => {
      dispatchContextEvent("clear-terminal");
    },
  },
  {
    id: "terminal-copy-output",
    title: "Copy Terminal Output",
    group: "Terminal",
    keywords: ["copy", "terminal", "output", "clipboard"],
    when: () => context().hasFocusedTerminal,
    run: () => {
      dispatchContextEvent("copy-terminal-output");
    },
  },
];

let registered = false;
let disposers: Array<() => void> = [];

export function installContextCommands(): () => void {
  if (registered) {
    return () => undefined;
  }
  registered = true;
  disposers = CONTEXT_COMMANDS.map((c) => registerCommand(c));
  return () => {
    for (const dispose of disposers) dispose();
    disposers = [];
    registered = false;
  };
}

export const __internal = {
  context,
  defaultContext,
};
