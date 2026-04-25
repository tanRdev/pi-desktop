import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RepositoryCatalog } from "./repository-catalog";
import { ThreadCatalog } from "./thread-catalog";

const temporaryDirectories: string[] = [];

function createUserDataPath(prefix: string): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function readCatalogDocument(userDataPath: string, fileName: string): unknown {
  return JSON.parse(
    readFileSync(path.join(userDataPath, "catalog", fileName), "utf8"),
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("RepositoryCatalog", () => {
  it("preserves repository behavior and persisted document shape", () => {
    let currentTime = 100;
    const userDataPath = createUserDataPath("repository-catalog-");
    const catalog = new RepositoryCatalog(userDataPath, {
      now: () => currentTime++,
    });

    const alpha = catalog.upsert({
      rootPath: "/tmp/workspaces/alpha/",
      label: "Alpha",
    });
    const beta = catalog.upsert({
      rootPath: "/tmp/workspaces/beta/",
    });

    const updatedAlpha = catalog.upsert({
      rootPath: "/tmp/workspaces/alpha/",
    });
    expect(updatedAlpha.label).toBe("Alpha");

    const selectedAlpha = catalog.setLastSelectedWorktree(
      alpha.id,
      "/tmp/workspaces/alpha/worktrees/main/",
    );

    expect(selectedAlpha).toEqual({
      ...alpha,
      label: "Alpha",
      lastSelectedWorktreeId: path.resolve(
        "/tmp/workspaces/alpha/worktrees/main",
      ),
      updatedAt: 103,
    });

    expect(
      catalog.reorder([beta.id]).map((repository) => repository.id),
    ).toEqual([beta.id, alpha.id]);

    expect(catalog.get("/tmp/workspaces/alpha/")?.id).toBe(alpha.id);

    expect(readCatalogDocument(userDataPath, "repositories.json")).toEqual({
      version: 1,
      repositories: [
        {
          id: beta.id,
          rootPath: beta.rootPath,
          label: null,
          order: 0,
          lastSelectedWorktreeId: null,
          addedAt: 101,
          updatedAt: 104,
        },
        {
          id: alpha.id,
          rootPath: alpha.rootPath,
          label: "Alpha",
          order: 1,
          lastSelectedWorktreeId: path.resolve(
            "/tmp/workspaces/alpha/worktrees/main",
          ),
          addedAt: 100,
          updatedAt: 104,
        },
      ],
    });
  });
});

describe("ThreadCatalog", () => {
  it("creates and updates thread entries without changing persisted shape", () => {
    let currentTime = 200;
    const userDataPath = createUserDataPath("thread-catalog-");
    const catalog = new ThreadCatalog(userDataPath, {
      now: () => currentTime++,
      createId: () => "thread-1",
    });

    const created = catalog.create({
      worktreeId: "/tmp/workspaces/alpha/main/",
      title: "Initial thread",
    });

    expect(created).toEqual({
      id: "thread-1",
      worktreeId: path.resolve("/tmp/workspaces/alpha/main"),
      title: "Initial thread",
      lastActivityAt: null,
      runtimeId: null,
      createdAt: 200,
      updatedAt: 200,
    });

    expect(
      catalog.ensureOpenThread({
        worktreeId: "/tmp/workspaces/alpha/main/",
        title: "Ignored",
      }),
    ).toEqual(created);

    expect(catalog.touch("thread-1", 250)?.lastActivityAt).toBe(250);
    expect(catalog.rename("thread-1", "Renamed thread")?.title).toBe(
      "Renamed thread",
    );
    expect(
      catalog.updateRuntimeSession("thread-1", "runtime-1")?.runtimeId,
    ).toBe("runtime-1");

    expect(catalog.listAll()).toEqual([
      {
        id: "thread-1",
        worktreeId: path.resolve("/tmp/workspaces/alpha/main"),
        title: "Renamed thread",
        lastActivityAt: 250,
        runtimeId: "runtime-1",
        createdAt: 200,
        updatedAt: 203,
      },
    ]);

    expect(readCatalogDocument(userDataPath, "threads.json")).toEqual({
      version: 1,
      threads: [
        {
          id: "thread-1",
          worktreeId: path.resolve("/tmp/workspaces/alpha/main"),
          title: "Renamed thread",
          lastActivityAt: 250,
          runtimeId: "runtime-1",
          createdAt: 200,
          updatedAt: 203,
        },
      ],
    });

    expect(catalog.delete("thread-1")).toBe(true);
    expect(catalog.delete("thread-1")).toBe(false);
  });

  it("migrates legacy runtime session names to runtime ids", () => {
    const userDataPath = createUserDataPath("thread-catalog-legacy-");
    const catalogDirectory = path.join(userDataPath, "catalog");
    mkdirSync(catalogDirectory, { recursive: true });
    writeFileSync(
      path.join(catalogDirectory, "threads.json"),
      `${JSON.stringify(
        {
          version: 1,
          threads: [
            {
              id: "legacy-thread",
              worktreeId: path.resolve("/tmp/workspaces/alpha/main"),
              title: "Legacy thread",
              lastActivityAt: 25,
              runtimeSessionName: "runtime-from-session-name",
              createdAt: 10,
              updatedAt: 11,
            },
            {
              id: "current-thread",
              worktreeId: path.resolve("/tmp/workspaces/alpha/main"),
              title: "Current thread",
              lastActivityAt: 50,
              runtimeId: "runtime-id",
              createdAt: 12,
              updatedAt: 13,
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const catalog = new ThreadCatalog(userDataPath);

    expect(catalog.listByWorktree("/tmp/workspaces/alpha/main/")).toEqual([
      {
        id: "current-thread",
        worktreeId: path.resolve("/tmp/workspaces/alpha/main"),
        title: "Current thread",
        lastActivityAt: 50,
        runtimeId: "runtime-id",
        createdAt: 12,
        updatedAt: 13,
      },
      {
        id: "legacy-thread",
        worktreeId: path.resolve("/tmp/workspaces/alpha/main"),
        title: "Legacy thread",
        lastActivityAt: 25,
        runtimeId: "runtime-from-session-name",
        createdAt: 10,
        updatedAt: 11,
      },
    ]);

    expect(catalog.get("legacy-thread")?.runtimeId).toBe(
      "runtime-from-session-name",
    );

    expect(readCatalogDocument(userDataPath, "threads.json")).toEqual({
      version: 1,
      threads: [
        {
          id: "legacy-thread",
          worktreeId: path.resolve("/tmp/workspaces/alpha/main"),
          title: "Legacy thread",
          lastActivityAt: 25,
          runtimeId: "runtime-from-session-name",
          createdAt: 10,
          updatedAt: 11,
        },
        {
          id: "current-thread",
          worktreeId: path.resolve("/tmp/workspaces/alpha/main"),
          title: "Current thread",
          lastActivityAt: 50,
          runtimeId: "runtime-id",
          createdAt: 12,
          updatedAt: 13,
        },
      ],
    });
  });
});
