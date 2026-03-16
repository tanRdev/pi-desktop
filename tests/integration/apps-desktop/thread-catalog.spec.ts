import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ThreadCatalog } from "../../../apps/desktop/src/main/thread-catalog";

const tempDirs: string[] = [];

function createUserDataPath(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "pidesk-thread-catalog-"));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("ThreadCatalog", () => {
  it("persists thread metadata and sorts active threads before archived threads", () => {
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
    catalog.archive(first.id);
    catalog.updateRuntimeSession(second.id, "pidesk-thread-2");

    const reloaded = new ThreadCatalog(userDataPath, { now, createId });
    expect(reloaded.listByWorktree("/tmp/work/repo-one")).toEqual([
      {
        id: "thread-2",
        worktreeId: "/tmp/work/repo-one",
        title: "Second thread",
        archivedAt: null,
        lastActivityAt: 200,
        runtimeSessionName: "pidesk-thread-2",
        createdAt: 2,
        updatedAt: 6,
      },
      {
        id: "thread-1",
        worktreeId: "/tmp/work/repo-one",
        title: "First thread",
        archivedAt: 5,
        lastActivityAt: 100,
        runtimeSessionName: null,
        createdAt: 1,
        updatedAt: 5,
      },
    ]);
  });

  it("reuses the newest open thread when ensuring a worktree thread", () => {
    let tick = 0;
    const now = () => ++tick;
    let idCounter = 0;
    const createId = () => `thread-${++idCounter}`;
    const userDataPath = createUserDataPath();
    const catalog = new ThreadCatalog(userDataPath, { now, createId });

    const first = catalog.ensureOpenThread({
      worktreeId: "/tmp/work/repo-one",
      title: "Current thread",
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
        title: "Current thread",
        archivedAt: null,
        lastActivityAt: null,
        runtimeSessionName: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
  });
});
