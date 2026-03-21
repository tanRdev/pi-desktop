import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
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
  test.setTimeout(45_000);

  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "pidesk-e2e-home-"));
  const userDataDir = path.join(homeDir, ".pidesk-test-user-data");
  const branchName = `feature/e2e-${Date.now()}`;
  const worktreeDirectoryName = branchName.replace(/[\\/]+/g, "-");
  const createdWorktreePath = path.join(
    homeDir,
    ".worktrees",
    "PiDesk",
    worktreeDirectoryName,
  );
  fs.mkdirSync(userDataDir, { recursive: true });

  const firstLaunch = await launchDesktopApp("pidesk-e2e-home-", {
    homeDir,
    userDataDir,
  });

  try {
    const { app, page } = firstLaunch;

    await waitForAppReady(page);

    await page
      .getByRole("button", { name: /Open repository /i })
      .first()
      .click();
    await page.getByRole("button", { name: /NEW WORKTREE/i }).click();
    await page.getByTestId("worktree-branch-input").fill(branchName);
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByText(branchName).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("current-worktree-label")).toHaveText(
      branchName,
    );

    await expect
      .poll(() => readSelection(userDataDir).worktreeId, { timeout: 10_000 })
      .toContain(worktreeDirectoryName);

    await app.close();

    const relaunched = await launchDesktopApp("pidesk-e2e-home-relaunch-", {
      homeDir,
      userDataDir,
    });
    try {
      await waitForAppReady(relaunched.page);
      await relaunched.page
        .getByRole("button", { name: /Open repository /i })
        .first()
        .click();
      await expect(relaunched.page.getByText(branchName).first()).toBeVisible();
      await expect(
        relaunched.page.getByTestId("current-worktree-label"),
      ).toHaveText(branchName);
      await expect(readSelection(userDataDir).worktreeId).toContain(
        worktreeDirectoryName,
      );
    } finally {
      await relaunched.app.close();
    }
  } finally {
    removeWorktree(repoRoot, createdWorktreePath, branchName);
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});
