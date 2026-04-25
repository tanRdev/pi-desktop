import { createEmptyWorkspaceSession } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";

import {
  createFileContentUpdate,
  createNoteContentUpdate,
  createThreadConversationUpdate,
} from "./workspace-session-store-content";

describe("workspace-session-store-content", () => {
  it("creates a thread conversation update without mutating the original map", () => {
    const session = {
      ...createEmptyWorkspaceSession("wt-1"),
      threadConversations: new Map<
        string,
        {
          messages: [];
          status: string;
          lastError: string | null;
        }
      >(),
      fileContents: new Map(),
      noteContents: new Map(),
    };

    const update = createThreadConversationUpdate(session, "thread-1", {
      messages: [],
      status: "running",
      lastError: null,
    });

    expect(session.threadConversations.has("thread-1")).toBe(false);
    expect(update.threadConversations.get("thread-1")?.status).toBe("running");
  });

  it("creates a file content update without mutating the original map", () => {
    const session = {
      ...createEmptyWorkspaceSession("wt-1"),
      threadConversations: new Map(),
      fileContents: new Map(),
      noteContents: new Map(),
    };

    const update = createFileContentUpdate(session, "window-1", {
      content: null,
      isLoading: true,
      error: null,
    });

    expect(session.fileContents.has("window-1")).toBe(false);
    expect(update.fileContents.get("window-1")?.isLoading).toBe(true);
  });

  it("creates note updates using the persisted note id or the note window fallback", () => {
    const session = {
      ...createEmptyWorkspaceSession("wt-1"),
      layout: {
        ...createEmptyWorkspaceSession("wt-1").layout,
        windows: [
          {
            id: "window-1",
            kind: "note" as const,
            noteId: "note-1",
            title: "Note",
            x: 0,
            y: 0,
            width: 300,
            height: 200,
            zIndex: 1,
            isFocused: true,
            state: "normal" as const,
            isDirty: false,
          },
        ],
      },
      notes: {},
      threadConversations: new Map(),
      fileContents: new Map(),
      noteContents: new Map(),
    };

    const update = createNoteContentUpdate(session, "window-1", "draft body");

    expect(update.noteContents.get("window-1")).toEqual({
      content: "draft body",
      error: null,
    });
    expect(update.notes["window-1"]).toEqual({
      noteId: "note-1",
      draft: "draft body",
    });
  });
});
