import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RepositoryPreferencesCatalog } from "../../../apps/desktop/src/main/repository-preferences-catalog";

const tempDirs: string[] = [];

function createUserDataPath(): string {
  const directory = mkdtempSync(
    path.join(tmpdir(), "pi-desktop-repository-preferences-"),
  );
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("RepositoryPreferencesCatalog", () => {
  it("persists repository display metadata and legacy label imports", () => {
    const userDataPath = createUserDataPath();
    const catalog = new RepositoryPreferencesCatalog(userDataPath);

    catalog.importLegacyLabels([
      {
        id: "/tmp/work/repo-one",
        rootPath: "/tmp/work/repo-one",
        label: "Legacy label",
        order: 0,
        lastSelectedWorktreeId: null,
        addedAt: 1,
        updatedAt: 1,
      },
    ]);
    catalog.upsert("/tmp/work/repo-one", {
      icon: "rocket",
      accentColor: "#2255aa",
    });

    const reloaded = new RepositoryPreferencesCatalog(userDataPath);
    expect(reloaded.get("/tmp/work/repo-one")).toEqual({
      repositoryId: "/tmp/work/repo-one",
      customName: "Legacy label",
      icon: "rocket",
      accentColor: "#2255aa",
    });
  });

  it("does not overwrite customized names when importing legacy labels", () => {
    const userDataPath = createUserDataPath();
    const catalog = new RepositoryPreferencesCatalog(userDataPath);

    catalog.upsert("/tmp/work/repo-one", {
      customName: "Customized",
      icon: null,
      accentColor: null,
    });
    catalog.importLegacyLabels([
      {
        id: "/tmp/work/repo-one",
        rootPath: "/tmp/work/repo-one",
        label: "Legacy label",
        order: 0,
        lastSelectedWorktreeId: null,
        addedAt: 1,
        updatedAt: 1,
      },
    ]);

    expect(catalog.get("/tmp/work/repo-one")).toEqual({
      repositoryId: "/tmp/work/repo-one",
      customName: "Customized",
      icon: null,
      accentColor: null,
    });
  });

  it("removes persisted repository preferences by repository id", () => {
    const userDataPath = createUserDataPath();
    const catalog = new RepositoryPreferencesCatalog(userDataPath);

    catalog.upsert("/tmp/work/repo-one", {
      customName: "Repo One",
      icon: "rocket",
      accentColor: "sky",
    });
    catalog.remove("/tmp/work/repo-one");

    const reloaded = new RepositoryPreferencesCatalog(userDataPath);
    expect(reloaded.get("/tmp/work/repo-one")).toBeNull();
  });
});
