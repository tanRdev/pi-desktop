import { createEmptyWorkspaceSession } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";

import { closeWorkspaceSessionWindow } from "./workspace-session-store-cleanup";

describe("workspace-session-store-cleanup", () => {
  it("drops file content and last thread conversation when closing a chat window", () => {
    const session = {
      ...createEmptyWorkspaceSession("wt-1"),
      layout: {
        ...createEmptyWorkspaceSession("wt-1").layout,
        windows: [
          {
            id: "chat-1",
            kind: "chat" as const,
            threadId: "thread-1",
            title: "Thread",
            x: 0,
            y: 0,
            width: 400,
            height: 300,
            zIndex: 1,
            isFocused: true,
            state: "normal" as const,
          },
          {
            id: "file-1",
            kind: "file" as const,
            title: "index.ts",
            x: 20,
            y: 20,
            width: 500,
            height: 320,
            zIndex: 2,
            isFocused: false,
            state: "normal" as const,
            filePath: "/repo/index.ts",
            isDirty: false,
          },
        ],
      },
      threadConversations: new Map([
        ["thread-1", { messages: [], status: "idle", lastError: null }],
      ]),
      fileContents: new Map([
        ["chat-1", { content: null, isLoading: false, error: null }],
      ]),
      noteContents: new Map(),
    };

    const nextSession = closeWorkspaceSessionWindow(session, "chat-1");

    expect(nextSession.layout.windows.map((window) => window.id)).toEqual([
      "file-1",
    ]);
    expect(nextSession.fileContents.has("chat-1")).toBe(false);
    expect(nextSession.threadConversations.has("thread-1")).toBe(false);
  });

  it("preserves shared chat conversations and note drafts still referenced by other windows", () => {
    const session = {
      ...createEmptyWorkspaceSession("wt-1"),
      layout: {
        ...createEmptyWorkspaceSession("wt-1").layout,
        windows: [
          {
            id: "chat-1",
            kind: "chat" as const,
            threadId: "thread-1",
            title: "Thread A",
            x: 0,
            y: 0,
            width: 300,
            height: 200,
            zIndex: 1,
            isFocused: true,
            state: "normal" as const,
          },
          {
            id: "chat-2",
            kind: "chat" as const,
            threadId: "thread-1",
            title: "Thread B",
            x: 10,
            y: 10,
            width: 300,
            height: 200,
            zIndex: 2,
            isFocused: false,
            state: "normal" as const,
          },
          {
            id: "note-window-1",
            kind: "note" as const,
            noteId: "note-1",
            title: "Note A",
            x: 0,
            y: 0,
            width: 300,
            height: 200,
            zIndex: 3,
            isFocused: false,
            state: "normal" as const,
            isDirty: false,
          },
          {
            id: "note-window-2",
            kind: "note" as const,
            noteId: "note-1",
            title: "Note B",
            x: 20,
            y: 20,
            width: 300,
            height: 200,
            zIndex: 4,
            isFocused: false,
            state: "normal" as const,
            isDirty: false,
          },
        ],
      },
      notes: {
        "note-window-1": { noteId: "note-1", draft: "draft" },
      },
      threadConversations: new Map([
        ["thread-1", { messages: [], status: "idle", lastError: null }],
      ]),
      fileContents: new Map(),
      noteContents: new Map([
        ["note-window-1", { content: "draft", error: null }],
        ["note-1", { content: "draft", error: null }],
      ]),
    };

    const afterChatClose = closeWorkspaceSessionWindow(session, "chat-1");
    const afterNoteClose = closeWorkspaceSessionWindow(
      afterChatClose,
      "note-window-1",
    );

    expect(afterChatClose.threadConversations.has("thread-1")).toBe(true);
    expect(afterNoteClose.noteContents.has("note-1")).toBe(true);
    expect(afterNoteClose.notes["note-window-1"]).toBeDefined();
  });
});
