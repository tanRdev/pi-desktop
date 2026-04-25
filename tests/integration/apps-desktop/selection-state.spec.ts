import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SelectionState } from "../../../apps/desktop/src/main/selection-state";

const tempDirs: string[] = [];

function createUserDataPath(): string {
  const directory = mkdtempSync(
    path.join(tmpdir(), "pi-desktop-selection-state-"),
  );
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("SelectionState", () => {
  it("persists merged selection updates", () => {
    const userDataPath = createUserDataPath();
    const selection = new SelectionState(userDataPath);

    expect(selection.get()).toEqual({
      repositoryId: null,
      worktreeId: null,
      threadId: null,
    });

    selection.set({
      repositoryId: "repo-1",
      worktreeId: "repo-1/main",
    });
    selection.set({ threadId: "thread-1" });

    const reloaded = new SelectionState(userDataPath);
    expect(reloaded.get()).toEqual({
      repositoryId: "repo-1",
      worktreeId: "repo-1/main",
      threadId: "thread-1",
    });
  });

  it("normalizes repository and worktree ids on set and replace", () => {
    const userDataPath = createUserDataPath();
    const selection = new SelectionState(userDataPath);

    expect(
      selection.set({
        repositoryId: "repo-1/",
        worktreeId: "repo-1/main/",
        threadId: "thread-1",
      }),
    ).toEqual({
      repositoryId: "repo-1",
      worktreeId: "repo-1/main",
      threadId: "thread-1",
    });

    expect(
      selection.replace({
        repositoryId: "repo-2/",
        worktreeId: "repo-2/feature/",
        threadId: null,
      }),
    ).toEqual({
      repositoryId: "repo-2",
      worktreeId: "repo-2/feature",
      threadId: null,
    });
  });

  it("clears persisted selection state", () => {
    const userDataPath = createUserDataPath();
    const selection = new SelectionState(userDataPath);

    selection.set({
      repositoryId: "repo-1",
      worktreeId: "repo-1/main",
      threadId: "thread-1",
    });
    selection.clear();

    const reloaded = new SelectionState(userDataPath);
    expect(reloaded.get()).toEqual({
      repositoryId: null,
      worktreeId: null,
      threadId: null,
    });
  });
});
