import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ThreadCatalog } from "../../../apps/desktop/src/main/thread-catalog";

const tempDirs: string[] = [];

function createUserDataPath(): string {
  const directory = mkdtempSync(
    path.join(tmpdir(), "pi-desktop-thread-catalog-"),
  );
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("ThreadCatalog", () => {
  it("persists thread metadata", () => {
    let tick = 0;
    const now = () => ++tick;
    let idCounter = 0;
    const createId = () => `thread-${++idCounter}`;
    const userDataPath = createUserDataPath();
    const catalog = new ThreadCatalog(userDataPath, { now, createId });

    const first = catalog.create({
      worktreeId: "/tmp/work/repo-one",
      title: "First thread",
    });
    const second = catalog.create({
      worktreeId: "/tmp/work/repo-one/",
      title: "Second thread",
    });

    catalog.touch(first.id, 100);
    catalog.touch(second.id, 200);
    catalog.updateRuntimeSession(second.id, "local-thread-2");

    const reloaded = new ThreadCatalog(userDataPath, { now, createId });
    const threads = reloaded.listByWorktree("/tmp/work/repo-one");
    expect(threads).toHaveLength(2);
    expect(threads[0]?.id).toBe("thread-2");
    expect(threads[1]?.id).toBe("thread-1");
    expect(threads[0]?.lastActivityAt).toBe(200);
    expect(threads[1]?.lastActivityAt).toBe(100);
    expect(threads[0]?.runtimeId).toBe("local-thread-2");
    expect(threads[1]?.runtimeId).toBeNull();
  });

  it("reuses the newest thread when ensuring a worktree thread", () => {
    let tick = 0;
    const now = () => ++tick;
    let idCounter = 0;
    const createId = () => `thread-${++idCounter}`;
    const userDataPath = createUserDataPath();
    const catalog = new ThreadCatalog(userDataPath, { now, createId });

    const first = catalog.ensureOpenThread({
      worktreeId: "/tmp/work/repo-one",
      title: "North Star",
    });
    const second = catalog.ensureOpenThread({
      worktreeId: "/tmp/work/repo-one/",
      title: "Ignored title",
    });

    expect(second.id).toBe(first.id);
    expect(catalog.listByWorktree("/tmp/work/repo-one")).toEqual([
      {
        id: "thread-1",
        worktreeId: "/tmp/work/repo-one",
        title: "North Star",
        lastActivityAt: null,
        runtimeId: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
  });

  it("migrates legacy runtimeSessionName fields on read", () => {
    const userDataPath = createUserDataPath();
    const catalogPath = path.join(userDataPath, "catalog", "threads.json");

    mkdirSync(path.dirname(catalogPath), { recursive: true });
    writeFileSync(
      catalogPath,
      `${JSON.stringify(
        {
          version: 1,
          threads: [
            {
              id: "thread-1",
              worktreeId: "/tmp/work/repo-one",
              title: "Legacy thread",
              lastActivityAt: 7,
              runtimeSessionName: "legacy-runtime",
              createdAt: 1,
              updatedAt: 2,
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const catalog = new ThreadCatalog(userDataPath);

    expect(catalog.get("thread-1")).toMatchObject({
      runtimeId: "legacy-runtime",
    });
  });
});
