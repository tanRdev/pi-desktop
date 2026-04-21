// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { zoomManager } from "@/lib/zoom";
import { commandRegistry } from "./command-registry";
import {
  installWorkspaceCommands,
  WORKSPACE_COMMANDS,
} from "./workspace-commands";

afterEach(() => {
  commandRegistry.clear();
  localStorage.clear();
  zoomManager.resetZoom();
  if (typeof document !== "undefined") {
    document.documentElement.style.zoom = "";
  }
});

describe("workspace-commands", () => {
  const expectedIds = [
    "workspace-open-folder",
    "workspace-new-window",
    "workspace-toggle-fullscreen",
    "workspace-zoom-in",
    "workspace-zoom-out",
    "workspace-reset-zoom",
    "toggle-sidebar",
  ] as const;

  it("exposes all documented workspace command ids", () => {
    const ids = WORKSPACE_COMMANDS.map((c) => c.id);
    for (const id of expectedIds) {
      expect(ids).toContain(id);
    }
  });

  it("registers every workspace command into the global registry", () => {
    const dispose = installWorkspaceCommands();
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
    const first = installWorkspaceCommands();
    const second = installWorkspaceCommands();
    expect(commandRegistry.list()).toHaveLength(WORKSPACE_COMMANDS.length);
    second();
    expect(commandRegistry.list()).toHaveLength(WORKSPACE_COMMANDS.length);
    first();
    expect(commandRegistry.list()).toHaveLength(0);
  });

  describe("zoom commands", () => {
    it("zoomManager starts at 1", () => {
      expect(zoomManager.getZoom()).toBe(1);
    });

    it("zoomManager sets document.documentElement.style.zoom", () => {
      zoomManager.setZoom(1.2);
      expect(document.documentElement.style.zoom).toBe("1.2");
    });

    it("zoomManager clamps to minimum 0.5", () => {
      zoomManager.setZoom(0.1);
      expect(zoomManager.getZoom()).toBe(0.5);
    });

    it("zoomManager clamps to maximum 3", () => {
      zoomManager.setZoom(5);
      expect(zoomManager.getZoom()).toBe(3);
    });

    it("zoom-in increases zoom via zoomManager", () => {
      zoomManager.resetZoom();
      const dispose = installWorkspaceCommands();
      try {
        const cmd = commandRegistry.get("workspace-zoom-in");
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        });
        expect(zoomManager.getZoom()).toBeCloseTo(1.1, 5);
      } finally {
        dispose();
      }
    });

    it("zoom-out decreases zoom via zoomManager", () => {
      zoomManager.setZoom(1.2);
      const dispose = installWorkspaceCommands();
      try {
        const cmd = commandRegistry.get("workspace-zoom-out");
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        });
        expect(zoomManager.getZoom()).toBeCloseTo(1.1, 5);
      } finally {
        dispose();
      }
    });

    it("reset-zoom sets zoom back to 1", () => {
      zoomManager.setZoom(1.5);
      const dispose = installWorkspaceCommands();
      try {
        const cmd = commandRegistry.get("workspace-reset-zoom");
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        });
        expect(zoomManager.getZoom()).toBe(1);
      } finally {
        dispose();
      }
    });
  });

  describe("open-folder", () => {
    it("falls back to pi:command dispatch when dialog.openDirectory is not available", () => {
      const listener = vi.fn();
      window.addEventListener("pi:command", listener);
      const dispose = installWorkspaceCommands();
      try {
        const cmd = commandRegistry.get("workspace-open-folder");
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        });
        expect(listener).toHaveBeenCalledTimes(1);
        const call = listener.mock.calls[0];
        const event = call?.[0];
        expect(event?.detail.commandId).toBe("open-folder");
      } finally {
        dispose();
        window.removeEventListener("pi:command", listener);
      }
    });

    it("calls dialog.openDirectory when available", () => {
      const openDirectory = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(window, "piDesktop", {
        value: {
          dialog: { openDirectory },
        },
        writable: true,
        configurable: true,
      });
      const dispose = installWorkspaceCommands();
      try {
        const cmd = commandRegistry.get("workspace-open-folder");
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        });
        expect(openDirectory).toHaveBeenCalledTimes(1);
      } finally {
        dispose();
        (window as unknown as Record<string, unknown>).piDesktop = undefined;
      }
    });
  });

  describe("stub commands", () => {
    it("new-window dispatches pi:command with commandId", () => {
      const listener = vi.fn();
      window.addEventListener("pi:command", listener);
      const dispose = installWorkspaceCommands();
      try {
        const cmd = commandRegistry.get("workspace-new-window");
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        });
        expect(listener).toHaveBeenCalledTimes(1);
        const call = listener.mock.calls[0];
        const event = call?.[0];
        expect(event?.detail.commandId).toBe("new-window");
      } finally {
        dispose();
        window.removeEventListener("pi:command", listener);
      }
    });

    it("toggle-fullscreen dispatches pi:command with commandId", () => {
      const listener = vi.fn();
      window.addEventListener("pi:command", listener);
      const dispose = installWorkspaceCommands();
      try {
        const cmd = commandRegistry.get("workspace-toggle-fullscreen");
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        });
        expect(listener).toHaveBeenCalledTimes(1);
        const call = listener.mock.calls[0];
        const event = call?.[0];
        expect(event?.detail.commandId).toBe("toggle-fullscreen");
      } finally {
        dispose();
        window.removeEventListener("pi:command", listener);
      }
    });

    it("toggle-sidebar dispatches pi:command with toggle-sidebar", () => {
      const listener = vi.fn();
      window.addEventListener("pi:command", listener);
      const dispose = installWorkspaceCommands();
      try {
        const cmd = commandRegistry.get("toggle-sidebar");
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        });
        expect(listener).toHaveBeenCalledTimes(1);
        const call = listener.mock.calls[0];
        const event = call?.[0];
        expect(event?.detail.commandId).toBe("toggle-sidebar");
      } finally {
        dispose();
        window.removeEventListener("pi:command", listener);
      }
    });
  });
});
