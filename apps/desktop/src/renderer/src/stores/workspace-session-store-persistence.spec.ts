import { createEmptyWorkspaceSession } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";

import {
  applyWorkspaceSessionLayout,
  cloneWorkspaceSession,
  mergeWorkspaceSession,
  toPersistedWorkspaceSession,
  updateWorkspaceSessionRecord,
} from "./workspace-session-store-persistence";

describe("workspace-session-store-persistence", () => {
  it("clones a persisted session into renderer state without mutating source records", () => {
    const session = createEmptyWorkspaceSession("wt-1");
    session.layout.windows = [
      {
        id: "note-window",
        kind: "note",
        noteId: "note-1",
        title: "Note",
        x: 0,
        y: 0,
        width: 320,
        height: 240,
        zIndex: 1,
        isFocused: true,
        state: "normal",
        isDirty: false,
      },
    ];
    session.notes.noteRef = { noteId: "note-1", draft: "persisted draft" };

    const cloned = cloneWorkspaceSession(session);

    expect(cloned).not.toBe(session);
    expect(cloned.layout).not.toBe(session.layout);
    expect(cloned.layout.windows).not.toBe(session.layout.windows);
    expect(cloned.notes).not.toBe(session.notes);
    expect(cloned.noteContents.get("noteRef")).toEqual({
      content: "persisted draft",
      error: null,
    });
    expect(cloned.threadConversations.size).toBe(0);
    expect(cloned.fileContents.size).toBe(0);
  });

  it("merges persisted session data while preserving runtime maps", () => {
    const current = cloneWorkspaceSession(createEmptyWorkspaceSession("wt-1"));
    current.threadConversations.set("thread-1", {
      messages: [],
      status: "running",
      lastError: null,
    });
    current.fileContents.set("file-window", {
      content: null,
      isLoading: true,
      error: null,
    });
    current.noteContents.set("note-window", {
      content: "draft",
      error: null,
    });

    const incoming = createEmptyWorkspaceSession("wt-1");
    incoming.promptDrafts.compose = "hello";

    const merged = mergeWorkspaceSession(current, incoming);

    expect(merged.promptDrafts.compose).toBe("hello");
    expect(merged.threadConversations).toBe(current.threadConversations);
    expect(merged.fileContents).toBe(current.fileContents);
    expect(merged.noteContents).toBe(current.noteContents);
  });

  it("serializes renderer sessions back to persisted sessions without runtime maps", () => {
    const session = cloneWorkspaceSession(createEmptyWorkspaceSession("wt-1"));
    session.threadConversations.set("thread-1", {
      messages: [],
      status: "idle",
      lastError: null,
    });

    const persisted = toPersistedWorkspaceSession(session);

    expect(persisted).toEqual({
      worktreeId: "wt-1",
      layout: session.layout,
      sidebar: session.sidebar,
      promptDrafts: session.promptDrafts,
      search: session.search,
      files: session.files,
      notes: session.notes,
      recoveryDrafts: session.recoveryDrafts,
    });
    expect("threadConversations" in persisted).toBe(false);
    expect("fileContents" in persisted).toBe(false);
    expect("noteContents" in persisted).toBe(false);
  });

  it("applies layout reducers without mutating the source session", () => {
    const session = cloneWorkspaceSession(createEmptyWorkspaceSession("wt-1"));
    const originalZoom = session.layout.zoom;

    const nextSession = applyWorkspaceSessionLayout(session, (windowState) => ({
      ...windowState,
      layout: {
        ...windowState.layout,
        zoom: 1.5,
      },
    }));

    expect(nextSession).not.toBe(session);
    expect(nextSession.layout.zoom).toBe(1.5);
    expect(session.layout.zoom).toBe(originalZoom);
  });

  it("updates a session record only when the target worktree exists", () => {
    const session = cloneWorkspaceSession(createEmptyWorkspaceSession("wt-1"));
    const sessionsByWorktreeId = { "wt-1": session };

    const updated = updateWorkspaceSessionRecord(
      sessionsByWorktreeId,
      "wt-1",
      (current) => ({
        ...current,
        promptDrafts: {
          ...current.promptDrafts,
          compose: "updated",
        },
      }),
    );

    expect(updated).not.toBe(sessionsByWorktreeId);
    expect(updated["wt-1"]?.promptDrafts.compose).toBe("updated");
    expect(sessionsByWorktreeId["wt-1"]?.promptDrafts.compose).toBeUndefined();

    const missing = updateWorkspaceSessionRecord(
      sessionsByWorktreeId,
      "wt-missing",
      (current) => current,
    );

    expect(missing).toBe(sessionsByWorktreeId);
  });
});
