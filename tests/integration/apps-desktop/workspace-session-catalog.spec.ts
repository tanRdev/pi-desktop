import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceSessionCatalog } from "../../../apps/desktop/src/main/workspace-session-catalog";
import { createEmptyWorkspaceSession } from "../../../packages/shared/src";

const tempDirs: string[] = [];

function createUserDataPath(): string {
  const directory = mkdtempSync(
    path.join(tmpdir(), "pidesk-workspace-session-catalog-"),
  );
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("WorkspaceSessionCatalog", () => {
  it("persists and reloads workspace sessions by worktree", () => {
    const userDataPath = createUserDataPath();
    const catalog = new WorkspaceSessionCatalog(userDataPath);
    const session = createEmptyWorkspaceSession("/tmp/work/repo-one/feature");

    session.sidebar = {
      activePanel: "notes",
      isCollapsed: false,
    };
    session.promptDrafts = {
      "thread-1": "Continue investigating runtime",
    };
    session.files = {
      "/tmp/work/repo-one/feature/src/app.ts": {
        filePath: "/tmp/work/repo-one/feature/src/app.ts",
        scrollTop: 24,
      },
    };
    session.notes = {
      "note-1": {
        noteId: "note-1",
        draft: "Ship the persistence seam",
      },
    };
    session.layout.windows = [
      {
        id: "chat-1",
        kind: "chat",
        title: "Chat",
        x: 40,
        y: 50,
        width: 800,
        height: 600,
        zIndex: 1,
        isFocused: true,
        state: "normal",
        threadId: "thread-1",
      },
    ];
    session.layout.focusedWindowId = "chat-1";

    catalog.save(session);

    const reloaded = new WorkspaceSessionCatalog(userDataPath);
    expect(reloaded.get("/tmp/work/repo-one/feature")).toEqual(session);
  });

  it("replaces existing sessions for normalized worktree ids", () => {
    const userDataPath = createUserDataPath();
    const catalog = new WorkspaceSessionCatalog(userDataPath);

    catalog.save(createEmptyWorkspaceSession("/tmp/work/repo-one/feature/"));
    const updatedSession = createEmptyWorkspaceSession(
      "/tmp/work/repo-one/feature",
    );
    updatedSession.search = {
      query: "workspace session",
      selectedPath: "/tmp/work/repo-one/feature/src/app.ts",
    };

    catalog.save(updatedSession);

    expect(catalog.list()).toEqual([updatedSession]);
  });

  it("drops transcript-like and arbitrary extra fields before persisting", () => {
    const userDataPath = createUserDataPath();
    const catalog = new WorkspaceSessionCatalog(userDataPath);
    const session = createEmptyWorkspaceSession("/tmp/work/repo-one/feature");

    session.layout.windows = [
      {
        id: "chat-1",
        kind: "chat",
        title: "Chat",
        x: 40,
        y: 50,
        width: 800,
        height: 600,
        zIndex: 1,
        isFocused: true,
        state: "normal",
        threadId: "thread-1",
        messages: [
          {
            role: "assistant",
            text: "Should never be persisted",
          },
        ],
      } as never,
    ];

    catalog.save({
      ...session,
      transcriptBodies: {
        "thread-1": "should never be written",
      },
      runtimeState: {
        currentTurn: "turn-1",
      },
      search: {
        query: "persisted",
        selectedPath: "/tmp/work/repo-one/feature/src/app.ts",
        transcriptPreview: "drop this",
      },
    } as never);

    const expectedSession = createEmptyWorkspaceSession(
      "/tmp/work/repo-one/feature",
    );
    expectedSession.layout.windows = [
      {
        id: "chat-1",
        kind: "chat",
        title: "Chat",
        x: 40,
        y: 50,
        width: 800,
        height: 600,
        zIndex: 1,
        isFocused: true,
        state: "normal",
        threadId: "thread-1",
      },
    ];
    expectedSession.search = {
      query: "persisted",
      selectedPath: "/tmp/work/repo-one/feature/src/app.ts",
    };

    expect(catalog.get("/tmp/work/repo-one/feature")).toEqual(expectedSession);
  });
});
