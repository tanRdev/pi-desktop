import type { FileContent } from "@pi-desktop/shared";
import { describe, expect, it, vi } from "vitest";
import {
  openFileWindowForWorktree,
  openProjectNoteWindowForWorktree,
  saveFileWindowForWorktree,
  saveNoteWindowForWorktree,
  syncActiveThreadConversation,
  updateFileDraftForWorktree,
} from "./workspace-session-runtime";
import { createWorkspaceSessionStore } from "./workspace-session-store";

function makeStore() {
  return createWorkspaceSessionStore({
    getWorkspaceSession: vi.fn(async () => null),
    saveWorkspaceSession: vi.fn(async (s) => s),
    persistDelayMs: 0,
  });
}

describe("syncActiveThreadConversation", () => {
  it("is a no-op when worktreeId or threadId is missing", () => {
    const sessionStore = makeStore();
    syncActiveThreadConversation({
      sessionStore,
      worktreeId: null,
      threadId: "t-1",
      conversation: { messages: [], status: "idle", lastError: null },
    });
    syncActiveThreadConversation({
      sessionStore,
      worktreeId: "wt-1",
      threadId: null,
      conversation: { messages: [], status: "idle", lastError: null },
    });
    expect(sessionStore.getState().sessionsByWorktreeId).toEqual({});
  });

  it("writes the conversation to the target worktree", async () => {
    const sessionStore = makeStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    syncActiveThreadConversation({
      sessionStore,
      worktreeId: "wt-1",
      threadId: "t-1",
      conversation: { messages: [], status: "running", lastError: null },
    });
    const session = sessionStore.getState().sessionsByWorktreeId["wt-1"];
    expect(session?.threadConversations.get("t-1")?.status).toBe("running");
  });
});

describe("openFileWindowForWorktree", () => {
  it("focuses an existing file window instead of re-opening", async () => {
    const sessionStore = makeStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    const existing = sessionStore.getState().createWindow({
      kind: "file",
      filePath: "/tmp/a.ts",
    });

    const focusWindow = vi.fn();
    const createWindow = vi.fn();
    const readFile = vi.fn<(path: string) => Promise<FileContent>>();

    const windows =
      sessionStore.getState().sessionsByWorktreeId["wt-1"]?.layout.windows ??
      [];

    const id = await openFileWindowForWorktree({
      sessionStore,
      windowActions: { createWindow, focusWindow },
      windows,
      worktreeId: "wt-1",
      worktreePath: "/tmp",
      filePath: "/tmp/a.ts",
      readFile,
    });

    expect(id).toBe(existing.id);
    expect(focusWindow).toHaveBeenCalledWith(existing.id);
    expect(createWindow).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });

  it("creates a new window and records error state when readFile fails", async () => {
    const sessionStore = makeStore();
    await sessionStore.getState().setActiveWorktree("wt-2");

    const createWindow = sessionStore.getState().createWindow;
    const focusWindow = sessionStore.getState().focusWindow;
    const readFile = vi.fn(async () => {
      throw new Error("boom");
    });

    const id = await openFileWindowForWorktree({
      sessionStore,
      windowActions: { createWindow, focusWindow },
      windows: [],
      worktreeId: "wt-2",
      worktreePath: "/tmp",
      filePath: "/tmp/missing.ts",
      readFile,
    });

    const session = sessionStore.getState().sessionsByWorktreeId["wt-2"];
    expect(session?.fileContents.get(id)?.error).toBe("boom");
    expect(session?.fileContents.get(id)?.isLoading).toBe(false);
  });
});

describe("updateFileDraftForWorktree", () => {
  it("updates text content in place", async () => {
    const sessionStore = makeStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    const created = sessionStore.getState().createWindow({
      kind: "file",
      filePath: "/tmp/a.ts",
    });
    sessionStore.getState().setFileContentForWorktree("wt-1", created.id, {
      content: {
        type: "text",
        content: "initial",
        encoding: "utf8",
        path: "/tmp/a.ts",
      },
      isLoading: false,
      error: null,
    });

    updateFileDraftForWorktree({
      sessionStore,
      worktreeId: "wt-1",
      windowId: created.id,
      content: "updated",
    });

    const entry = sessionStore
      .getState()
      .sessionsByWorktreeId["wt-1"]?.fileContents.get(created.id);
    expect(entry?.content?.type).toBe("text");
    if (entry?.content?.type === "text") {
      expect(entry.content.content).toBe("updated");
    }
  });

  it("is a no-op when the file content is not text", async () => {
    const sessionStore = makeStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    const created = sessionStore.getState().createWindow({
      kind: "file",
      filePath: "/tmp/a.png",
    });
    updateFileDraftForWorktree({
      sessionStore,
      worktreeId: "wt-1",
      windowId: created.id,
      content: "ignored",
    });
    expect(
      sessionStore
        .getState()
        .sessionsByWorktreeId["wt-1"]?.fileContents.get(created.id),
    ).toBeUndefined();
  });
});

describe("saveFileWindowForWorktree", () => {
  it("returns false when there is no text file state", async () => {
    const sessionStore = makeStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    const writeFile = vi.fn(async () => {});
    const ok = await saveFileWindowForWorktree({
      sessionStore,
      worktreeId: "wt-1",
      windowId: "nope",
      filePath: "/tmp/x.ts",
      writeFile,
    });
    expect(ok).toBe(false);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("writes the file and returns true on success", async () => {
    const sessionStore = makeStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    const created = sessionStore.getState().createWindow({
      kind: "file",
      filePath: "/tmp/a.ts",
    });
    sessionStore.getState().setFileContentForWorktree("wt-1", created.id, {
      content: {
        type: "text",
        content: "hello",
        encoding: "utf8",
        path: "/tmp/a.ts",
      },
      isLoading: false,
      error: null,
    });
    const writeFile = vi.fn(async () => {});
    const ok = await saveFileWindowForWorktree({
      sessionStore,
      worktreeId: "wt-1",
      windowId: created.id,
      filePath: "/tmp/a.ts",
      writeFile,
    });
    expect(ok).toBe(true);
    expect(writeFile).toHaveBeenCalledWith("/tmp/a.ts", "hello");
  });
});

describe("saveNoteWindowForWorktree", () => {
  it("returns false with no storagePath or missing worktree", async () => {
    const sessionStore = makeStore();
    const writeFile = vi.fn(async () => {});
    expect(
      await saveNoteWindowForWorktree({
        sessionStore,
        worktreeId: null,
        windowId: "w",
        storagePath: "/tmp/n.md",
        writeFile,
      }),
    ).toBe(false);
    expect(
      await saveNoteWindowForWorktree({
        sessionStore,
        worktreeId: "wt-1",
        windowId: "w",
        writeFile,
      }),
    ).toBe(false);
  });

  it("writes the note content when available", async () => {
    const sessionStore = makeStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    const created = sessionStore.getState().createWindow({ kind: "note" });
    sessionStore.getState().setNoteContent(created.id, "note-body");
    const writeFile = vi.fn(async () => {});
    const ok = await saveNoteWindowForWorktree({
      sessionStore,
      worktreeId: "wt-1",
      windowId: created.id,
      storagePath: "/tmp/n.md",
      writeFile,
    });
    expect(ok).toBe(true);
    expect(writeFile).toHaveBeenCalledWith("/tmp/n.md", "note-body");
  });
});

describe("openProjectNoteWindowForWorktree", () => {
  it("creates an untitled project note when no worktree path is provided", async () => {
    const sessionStore = makeStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    const created = vi.fn((_action: { kind: string }) =>
      sessionStore.getState().createWindow({ kind: "note" }),
    );
    const focus = vi.fn();
    const update = vi.fn();
    const readFile = vi.fn<(path: string) => Promise<FileContent>>();

    const id = await openProjectNoteWindowForWorktree({
      sessionStore,
      windowActions: {
        createWindow: created,
        focusWindow: focus,
        updateWindow: update,
      },
      windows: [],
      worktreeId: "wt-1",
      worktreePath: null,
      readFile,
    });

    expect(typeof id).toBe("string");
    expect(update).toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });
});
