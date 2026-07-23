import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushAllPersistentJsonFiles } from "../../../apps/desktop/src/main/catalogs/persistent-json-file";
import { WorkspaceSessionCatalog } from "../../../apps/desktop/src/main/catalogs/workspace-session-catalog";
import { createEmptyWorkspaceSession } from "../../../packages/shared/src";

const tempDirs: string[] = [];

function createUserDataPath(): string {
  const directory = mkdtempSync(
    path.join(tmpdir(), "pi-desktop-workspace-session-catalog-"),
  );
  tempDirs.push(directory);
  return directory;
}

function catalogFilePath(userDataPath: string): string {
  return path.join(userDataPath, "catalog", "workspace-sessions.json");
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

  it("loads a legacy unversioned file and rewrites it with an envelope on next save", async () => {
    const userDataPath = createUserDataPath();
    const filePath = catalogFilePath(userDataPath);
    const session = createEmptyWorkspaceSession("/tmp/work/repo-one/feature");
    session.sidebar = { activePanel: "notes", isCollapsed: false };

    const fs = await import("node:fs");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(
      filePath,
      JSON.stringify({ version: 1, sessions: [session] }),
      "utf8",
    );

    const catalog = new WorkspaceSessionCatalog(userDataPath);
    expect(catalog.get("/tmp/work/repo-one/feature")).toEqual(session);

    catalog.save({
      ...session,
      search: { query: "updated", selectedPath: null },
    });
    await flushAllPersistentJsonFiles();

    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    expect(parsed).toMatchObject({
      schemaVersion: 1,
      data: {
        sessions: [
          {
            ...session,
            search: { query: "updated", selectedPath: null },
          },
        ],
      },
    });
  });

  it("drops legacy search windows on load and repairs focusedWindowId", async () => {
    const userDataPath = createUserDataPath();
    const filePath = catalogFilePath(userDataPath);
    const session = createEmptyWorkspaceSession("/tmp/work/repo-one/feature");
    session.layout.windows = [
      {
        id: "search-1",
        kind: "search",
        title: "Search",
        x: 24,
        y: 36,
        width: 640,
        height: 480,
        zIndex: 2,
        isFocused: true,
        state: "normal",
        query: "legacy",
        results: [],
      },
      {
        id: "chat-1",
        kind: "chat",
        title: "Chat",
        x: 40,
        y: 50,
        width: 800,
        height: 600,
        zIndex: 1,
        isFocused: false,
        state: "normal",
        threadId: "thread-1",
      },
    ];
    session.layout.focusedWindowId = "search-1";

    const fs = await import("node:fs");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(
      filePath,
      JSON.stringify({ version: 1, sessions: [session] }),
      "utf8",
    );

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
        isFocused: false,
        state: "normal",
        threadId: "thread-1",
      },
    ];
    expectedSession.layout.focusedWindowId = null;

    const catalog = new WorkspaceSessionCatalog(userDataPath);
    expect(catalog.get("/tmp/work/repo-one/feature")).toEqual(expectedSession);
  });

  it("recovers to defaults when the persisted file is corrupt and quarantines the bad file", async () => {
    const userDataPath = createUserDataPath();
    const filePath = catalogFilePath(userDataPath);
    const fs = await import("node:fs");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, "{{{not-json", "utf8");

    const warn = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const catalog = new WorkspaceSessionCatalog(userDataPath);
    expect(catalog.list()).toEqual([]);

    warn.mockRestore();

    const siblings = readdirSync(path.dirname(filePath)).filter((entry) =>
      entry.startsWith("workspace-sessions.json.corrupt-"),
    );
    expect(siblings.length).toBe(1);
  });
});
