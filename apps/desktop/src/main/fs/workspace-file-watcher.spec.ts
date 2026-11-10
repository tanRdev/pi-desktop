import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FileChangeEvent } from "@pi-desktop/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspaceFileWatcherService,
  type FileWatchSender,
  type WatchDirectoryFn,
} from "./workspace-file-watcher";

function createFakeSender() {
  const sent: Array<{ channel: string; payload: FileChangeEvent }> = [];
  const destroyedListeners: Array<() => void> = [];
  const sender: FileWatchSender & {
    sent: typeof sent;
    triggerDestroyed: () => void;
  } = {
    sent,
    send: (channel, payload) => {
      sent.push({ channel, payload });
    },
    once: (_event, listener) => {
      destroyedListeners.push(listener);
    },
    triggerDestroyed: () => {
      for (const listener of destroyedListeners) listener();
    },
  };
  return sender;
}

function createFakeWatchDirectory() {
  const listeners = new Map<
    string,
    (eventType: "rename" | "change", filename: string | null) => void
  >();
  const closed: string[] = [];
  const watchDirectory: WatchDirectoryFn = (rootPath, listener) => {
    listeners.set(rootPath, listener);
    return {
      close: () => {
        closed.push(rootPath);
        listeners.delete(rootPath);
      },
    };
  };
  return { watchDirectory, listeners, closed };
}

describe("createWorkspaceFileWatcherService", () => {
  it("forwards classified events for nested paths on the fs:changed channel", () => {
    const fake = createFakeWatchDirectory();
    const service = createWorkspaceFileWatcherService(
      fake.watchDirectory,
      () => 42,
    );
    const sender = createFakeSender();

    service.subscribe(sender, "/root");
    const listener = fake.listeners.get("/root");
    expect(listener).toBeDefined();

    // "change" events are content modifications.
    listener?.("change", path.join("src", "deep", "file.ts"));
    expect(sender.sent).toEqual([
      {
        channel: "fs:changed",
        payload: {
          type: "modify",
          path: path.join("/root", "src", "deep", "file.ts"),
          timestamp: 42,
        },
      },
    ]);
  });

  it("classifies rename events by existence and ignores dependency/VCS trees", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pi-watch-"));
    try {
      mkdirSync(path.join(root, "src"), { recursive: true });
      writeFileSync(path.join(root, "src", "kept.ts"), "x");
      const fake = createFakeWatchDirectory();
      const service = createWorkspaceFileWatcherService(fake.watchDirectory);
      const sender = createFakeSender();
      service.subscribe(sender, root);
      const listener = fake.listeners.get(root);

      listener?.("rename", path.join("src", "kept.ts"));
      listener?.("rename", path.join("src", "gone.ts"));
      listener?.("change", path.join("node_modules", "pkg", "index.js"));
      listener?.("rename", path.join(".git", "index"));

      const types = sender.sent.map((entry) => entry.payload.type);
      expect(types).toEqual(["create", "delete"]);
      service.unsubscribeAll(sender);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("shares one watcher per root and closes it when the last sender leaves", () => {
    const fake = createFakeWatchDirectory();
    const service = createWorkspaceFileWatcherService(fake.watchDirectory);
    const first = createFakeSender();
    const second = createFakeSender();

    service.subscribe(first, "/root");
    service.subscribe(second, "/root");
    expect(fake.listeners.size).toBe(1);
    expect(service.watcherCountFor(first)).toBe(1);

    service.unsubscribe(first, "/root");
    expect(fake.closed).toEqual([]);
    fake.listeners.get("/root")?.("change", "a.ts");
    expect(first.sent).toHaveLength(0);
    expect(second.sent).toHaveLength(1);

    service.unsubscribe(second, "/root");
    expect(fake.closed).toEqual(["/root"]);
    expect(service.watcherCountFor(second)).toBe(0);
  });

  it("tears down a sender's watches when the sender is destroyed", () => {
    const fake = createFakeWatchDirectory();
    const service = createWorkspaceFileWatcherService(fake.watchDirectory);
    const sender = createFakeSender();

    service.subscribe(sender, "/root");
    sender.triggerDestroyed();

    expect(service.watcherCountFor(sender)).toBe(0);
    expect(fake.closed).toEqual(["/root"]);
  });

  describe("with the real filesystem", () => {
    let root: string;

    afterEach(() => {
      if (root) {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("reports a file created in a nested directory", async () => {
      root = mkdtempSync(path.join(tmpdir(), "pi-watch-real-"));
      mkdirSync(path.join(root, "src", "deep"), { recursive: true });
      const service = createWorkspaceFileWatcherService();
      const sender = createFakeSender();
      service.subscribe(sender, root);

      const nestedPath = path.join(root, "src", "deep", "new-file.ts");
      writeFileSync(nestedPath, "export {};\n");

      await vi.waitFor(() => {
        expect(
          sender.sent.some(
            (entry) =>
              entry.payload.path === nestedPath &&
              entry.payload.type === "create",
          ),
        ).toBe(true);
      });

      service.unsubscribeAll(sender);
      expect(service.watcherCountFor(sender)).toBe(0);
    });
  });
});
