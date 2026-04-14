import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  ensureWorkspaceMode,
  launchDesktopApp,
  removeWorktree,
  repoRoot,
  waitForAppReady,
} from "./helpers/desktop-app";

function readSelection(userDataDir: string): {
  repositoryId: string | null;
  worktreeId: string | null;
  threadId: string | null;
} {
  const selectionPath = path.join(userDataDir, "catalog", "selection.json");
  return JSON.parse(fs.readFileSync(selectionPath, "utf8")) as {
    repositoryId: string | null;
    worktreeId: string | null;
    threadId: string | null;
  };
}

test("creates a worktree and restores worktree selection after relaunch", async () => {
  test.setTimeout(60_000);

  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-desktop-e2e-home-"));
  const userDataDir = path.join(homeDir, ".pi-desktop-test-user-data");
  const branchName = `feature/e2e-${Date.now()}`;
  const worktreeDirectoryName = branchName.replace(/[\\/]+/g, "-");
  const createdWorktreePath = path.join(
    homeDir,
    ".worktrees",
    "pi-desktop",
    worktreeDirectoryName,
  );
  fs.mkdirSync(userDataDir, { recursive: true });

  const firstLaunch = await launchDesktopApp("pi-desktop-e2e-home-", {
    homeDir,
    userDataDir,
  });

  try {
    const { app, page } = firstLaunch;

    await waitForAppReady(page);

    await ensureWorkspaceMode(page);
    const repositoryId = readSelection(userDataDir).repositoryId;
    if (!repositoryId) {
      throw new Error("Expected an active repository selection");
    }

    await page.evaluate(
      async ({ nextRepositoryId, nextBranchName }) => {
        await window.piDesktop.worktrees.create(nextRepositoryId, nextBranchName);
      },
      { nextRepositoryId: repositoryId, nextBranchName: branchName },
    );

    await expect
      .poll(() => readSelection(userDataDir).worktreeId, { timeout: 10_000 })
      .toContain(worktreeDirectoryName);

    await closeDesktopApp(app);

    const relaunched = await launchDesktopApp("pi-desktop-e2e-home-relaunch-", {
      homeDir,
      userDataDir,
    });
    try {
      await waitForAppReady(relaunched.page);
      await ensureWorkspaceMode(relaunched.page);
      await expect(readSelection(userDataDir).worktreeId).toContain(
        worktreeDirectoryName,
      );
      await expect
        .poll(
          () =>
            relaunched.page.evaluate(async () => {
              const shell = await window.piDesktop.shell.getSnapshot();
              return shell.catalog.selection.worktreeId;
            }),
          { timeout: 10_000 },
        )
        .toContain(worktreeDirectoryName);
    } finally {
      await closeDesktopApp(relaunched.app);
    }
  } finally {
    removeWorktree(repoRoot, createdWorktreePath, branchName);
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});
