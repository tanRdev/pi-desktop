import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FileWatchSender,
  WorkspaceFileWatcherService,
} from "../fs/workspace-file-watcher";
import { registerFilesystemHandlers } from "./register-filesystem-handlers";

type HandlerListener = (
  event?: unknown,
  payload?: unknown,
) => Promise<unknown> | unknown;

describe("registerFilesystemHandlers watch contracts", () => {
  let root: string;
  let workspaceDir: string;
  let listeners: Map<string, HandlerListener>;
  let subscribe: ReturnType<
    typeof vi.fn<(sender: FileWatchSender, rootPath: string) => void>
  >;
  let unsubscribe: ReturnType<
    typeof vi.fn<(sender: FileWatchSender, rootPath: string) => void>
  >;
  let sender: FileWatchSender;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "pi-fs-handlers-"));
    workspaceDir = path.join(root, "workspace");
    mkdirSync(workspaceDir, { recursive: true });

    listeners = new Map();
    subscribe = vi.fn();
    unsubscribe = vi.fn();
    const fileWatcher: WorkspaceFileWatcherService = {
      subscribe,
      unsubscribe,
      unsubscribeAll: vi.fn(),
      watcherCountFor: vi.fn(() => 0),
    };
    sender = { send: vi.fn() };

    registerFilesystemHandlers({
      handle: (channel, listener) => {
        listeners.set(channel, listener as HandlerListener);
      },
      getWorkspaceRootPath: () => root,
      fileWatcher,
    });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("subscribes the event sender with the canonical watched path", async () => {
    const watchListener = listeners.get("fs:watch");
    expect(watchListener).toBeDefined();

    await watchListener?.({ sender }, { path: workspaceDir });

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(
      sender,
      expect.stringContaining("workspace"),
    );
    const subscribedPath = subscribe.mock.calls[0]?.[1] as string;
    expect(path.basename(subscribedPath)).toBe("workspace");
  });

  it("unsubscribes the event sender on fs:unwatch", async () => {
    const unwatchListener = listeners.get("fs:unwatch");
    expect(unwatchListener).toBeDefined();

    await unwatchListener?.({ sender }, { path: workspaceDir });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe.mock.calls[0]?.[0]).toBe(sender);
  });

  it("rejects watch requests without an IPC sender", async () => {
    const watchListener = listeners.get("fs:watch");
    await expect(watchListener?.({}, { path: workspaceDir })).rejects.toThrow();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("rejects watch paths outside the workspace root", async () => {
    const watchListener = listeners.get("fs:watch");
    const outside = path.join(tmpdir(), "pi-fs-handlers-outside");
    await expect(
      watchListener?.({ sender }, { path: outside }),
    ).rejects.toThrow();
    expect(subscribe).not.toHaveBeenCalled();
  });
});
