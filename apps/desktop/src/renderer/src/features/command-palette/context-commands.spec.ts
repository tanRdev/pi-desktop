// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { commandRegistry } from "./command-registry";
import {
  __internal,
  CONTEXT_COMMANDS,
  installContextCommands,
} from "./context-commands";

const { context, defaultContext } = __internal;

afterEach(() => {
  commandRegistry.clear();
  delete window.__piCommandContext;
});

describe("context-commands", () => {
  const expectedIds = [
    "editor-close-file",
    "editor-save-file",
    "editor-reveal-in-tree",
    "thread-archive",
    "thread-rename",
    "thread-share-transcript",
    "terminal-clear",
    "terminal-copy-output",
  ] as const;

  it("exposes all documented context command ids", () => {
    const ids = CONTEXT_COMMANDS.map((c) => c.id);
    for (const id of expectedIds) {
      expect(ids).toContain(id);
    }
  });

  it("registers every context command into the global registry", () => {
    const dispose = installContextCommands();
    try {
      for (const id of expectedIds) {
        expect(commandRegistry.get(id)).toBeDefined();
      }
    } finally {
      dispose();
    }
    for (const id of expectedIds) {
      expect(commandRegistry.get(id)).toBeUndefined();
    }
  });

  it("is idempotent — second install is a no-op", () => {
    const first = installContextCommands();
    const second = installContextCommands();
    expect(commandRegistry.list()).toHaveLength(CONTEXT_COMMANDS.length);
    second();
    expect(commandRegistry.list()).toHaveLength(CONTEXT_COMMANDS.length);
    first();
    expect(commandRegistry.list()).toHaveLength(0);
  });

  it("invokes run without throwing for editor commands", () => {
    const dispose = installContextCommands();
    try {
      const cmd = commandRegistry.get("editor-close-file");
      expect(cmd).toBeDefined();
      expect(() =>
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        }),
      ).not.toThrow();
    } finally {
      dispose();
    }
  });

  it("invokes run without throwing for thread commands", () => {
    const dispose = installContextCommands();
    try {
      const cmd = commandRegistry.get("thread-archive");
      expect(cmd).toBeDefined();
      expect(() =>
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        }),
      ).not.toThrow();
    } finally {
      dispose();
    }
  });

  it("invokes run without throwing for terminal commands", () => {
    const dispose = installContextCommands();
    try {
      const cmd = commandRegistry.get("terminal-clear");
      expect(cmd).toBeDefined();
      expect(() =>
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        }),
      ).not.toThrow();
    } finally {
      dispose();
    }
  });

  describe("when predicates", () => {
    it("editor commands are hidden by default (no focused file)", () => {
      const defaults = defaultContext();
      expect(defaults.hasFocusedEditorFile).toBe(false);
      expect(defaults.hasActiveThread).toBe(false);
      expect(defaults.hasFocusedTerminal).toBe(false);
    });

    it("editor commands return true when hasFocusedEditorFile is true", () => {
      window.__piCommandContext = {
        hasFocusedEditorFile: true,
        hasActiveThread: false,
        hasFocusedTerminal: false,
      };
      expect(context().hasFocusedEditorFile).toBe(true);
      const editorCmd = CONTEXT_COMMANDS.find(
        (c) => c.id === "editor-close-file",
      );
      expect(editorCmd).toBeDefined();
      expect(editorCmd?.when?.()).toBe(true);
    });

    it("editor commands return false when hasFocusedEditorFile is false", () => {
      window.__piCommandContext = {
        hasFocusedEditorFile: false,
        hasActiveThread: true,
        hasFocusedTerminal: true,
      };
      const editorCmd = CONTEXT_COMMANDS.find(
        (c) => c.id === "editor-save-file",
      );
      expect(editorCmd?.when?.()).toBe(false);
    });

    it("thread commands return true when hasActiveThread is true", () => {
      window.__piCommandContext = {
        hasFocusedEditorFile: false,
        hasActiveThread: true,
        hasFocusedTerminal: false,
      };
      const threadCmd = CONTEXT_COMMANDS.find((c) => c.id === "thread-rename");
      expect(threadCmd?.when?.()).toBe(true);
    });

    it("thread commands return false when hasActiveThread is false", () => {
      window.__piCommandContext = {
        hasFocusedEditorFile: true,
        hasActiveThread: false,
        hasFocusedTerminal: false,
      };
      const threadCmd = CONTEXT_COMMANDS.find(
        (c) => c.id === "thread-share-transcript",
      );
      expect(threadCmd?.when?.()).toBe(false);
    });

    it("terminal commands return true when hasFocusedTerminal is true", () => {
      window.__piCommandContext = {
        hasFocusedEditorFile: false,
        hasActiveThread: false,
        hasFocusedTerminal: true,
      };
      const termCmd = CONTEXT_COMMANDS.find(
        (c) => c.id === "terminal-copy-output",
      );
      expect(termCmd?.when?.()).toBe(true);
    });

    it("terminal commands return false when hasFocusedTerminal is false", () => {
      window.__piCommandContext = {
        hasFocusedEditorFile: true,
        hasActiveThread: true,
        hasFocusedTerminal: false,
      };
      const termCmd = CONTEXT_COMMANDS.find((c) => c.id === "terminal-clear");
      expect(termCmd?.when?.()).toBe(false);
    });
  });

  describe("command dispatch", () => {
    it("dispatches pi:context:close-file event on editor-close-file", () => {
      const listener = vi.fn();
      window.addEventListener("pi:context:close-file", listener);
      const dispose = installContextCommands();
      try {
        const cmd = commandRegistry.get("editor-close-file");
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        });
        expect(listener).toHaveBeenCalledTimes(1);
      } finally {
        dispose();
        window.removeEventListener("pi:context:close-file", listener);
      }
    });

    it("dispatches pi:context:archive-thread event on thread-archive", () => {
      const listener = vi.fn();
      window.addEventListener("pi:context:archive-thread", listener);
      const dispose = installContextCommands();
      try {
        const cmd = commandRegistry.get("thread-archive");
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        });
        expect(listener).toHaveBeenCalledTimes(1);
      } finally {
        dispose();
        window.removeEventListener("pi:context:archive-thread", listener);
      }
    });
  });
});
