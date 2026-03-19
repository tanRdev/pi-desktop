import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RepositoryCatalog } from "../../../apps/desktop/src/main/repository-catalog";

const tempDirs: string[] = [];

function createUserDataPath(): string {
  const directory = mkdtempSync(
    path.join(tmpdir(), "pidesk-repository-catalog-"),
  );
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("RepositoryCatalog", () => {
  it("persists repositories, ordering, and last selected worktree", () => {
    let tick = 0;
    const now = () => ++tick;
    const userDataPath = createUserDataPath();
    const catalog = new RepositoryCatalog(userDataPath, { now });

    const repoOne = catalog.upsert({ rootPath: "/tmp/work/repo-one" });
    const repoTwo = catalog.upsert({
      rootPath: "/tmp/work/repo-two/",
      label: "Client repo",
    });
    catalog.setLastSelectedWorktree(repoTwo.id, "/tmp/work/repo-two/feature-x");

    const reloaded = new RepositoryCatalog(userDataPath, { now });
    expect(reloaded.list()).toEqual([
      {
        id: "/tmp/work/repo-one",
        rootPath: "/tmp/work/repo-one",
        label: null,
        order: 0,
        lastSelectedWorktreeId: null,
        addedAt: 1,
        updatedAt: 1,
      },
      {
        id: "/tmp/work/repo-two",
        rootPath: "/tmp/work/repo-two",
        label: "Client repo",
        order: 1,
        lastSelectedWorktreeId: "/tmp/work/repo-two/feature-x",
        addedAt: 2,
        updatedAt: 3,
      },
    ]);

    expect(repoOne.id).toBe("/tmp/work/repo-one");
    expect(repoTwo.id).toBe("/tmp/work/repo-two");
  });

  it("updates existing entries instead of duplicating normalized paths", () => {
    let tick = 0;
    const now = () => ++tick;
    const userDataPath = createUserDataPath();
    const catalog = new RepositoryCatalog(userDataPath, { now });

    const first = catalog.upsert({ rootPath: "/tmp/work/repo-one/" });
    const second = catalog.upsert({
      rootPath: "/tmp/work/repo-one",
      label: "Renamed repo",
    });

    expect(second.id).toBe(first.id);
    expect(catalog.list()).toEqual([
      {
        id: "/tmp/work/repo-one",
        rootPath: "/tmp/work/repo-one",
        label: "Renamed repo",
        order: 0,
        lastSelectedWorktreeId: null,
        addedAt: 1,
        updatedAt: 2,
      },
    ]);
  });

  it("reorders repositories and persists normalized order values", () => {
    let tick = 0;
    const now = () => ++tick;
    const userDataPath = createUserDataPath();
    const catalog = new RepositoryCatalog(userDataPath, { now });

    const repoOne = catalog.upsert({ rootPath: "/tmp/work/repo-one" });
    const repoTwo = catalog.upsert({ rootPath: "/tmp/work/repo-two" });
    const repoThree = catalog.upsert({ rootPath: "/tmp/work/repo-three" });

    catalog.reorder([repoThree.id, repoOne.id, repoTwo.id]);

    const reloaded = new RepositoryCatalog(userDataPath, { now });

    expect(reloaded.list().map((repository) => repository.id)).toEqual([
      "/tmp/work/repo-three",
      "/tmp/work/repo-one",
      "/tmp/work/repo-two",
    ]);
    expect(reloaded.list().map((repository) => repository.order)).toEqual([
      0, 1, 2,
    ]);
  });
});
