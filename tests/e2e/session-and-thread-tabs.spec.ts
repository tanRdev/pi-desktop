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

test("creates a session from the rail and manages thread tabs inside it", async () => {
  test.setTimeout(90_000);

  const homeDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-desktop-e2e-session-tabs-"),
  );
  const userDataDir = path.join(homeDir, ".pi-desktop-test-user-data");
  const branchName = `feature/e2e-session-${Date.now()}`;
  const worktreeDirectoryName = branchName.replace(/[\\/]+/g, "-");
  const createdWorktreePath = path.join(
    homeDir,
    ".worktrees",
    "pi-desktop",
    worktreeDirectoryName,
  );

  fs.mkdirSync(userDataDir, { recursive: true });

  const { app, page } = await launchDesktopApp("pi-desktop-e2e-session-tabs-", {
    homeDir,
    userDataDir,
  });

  try {
    await waitForAppReady(page);
    await ensureWorkspaceMode(page);

    await page.getByText("Sessions").hover();
    await page.getByTestId("create-session-button").click();
    await expect(
      page.getByRole("dialog", { name: "Create session" }),
    ).toBeVisible();
    await page.getByTestId("worktree-branch-input").fill(branchName);
    await page.getByRole("button", { name: "Create" }).click();

    await expect
      .poll(
        async () => {
          const shell = await page.evaluate(async () => {
            const snapshot = await window.piDesktop.shell.getSnapshot();
            return {
              worktreeId: snapshot.catalog.selection.worktreeId,
              threadId: snapshot.catalog.selection.threadId,
              worktreeLabels:
                snapshot.catalog.repositories[0]?.worktrees.map(
                  (worktree) => worktree.label,
                ) ?? [],
            };
          });

          return shell;
        },
        { timeout: 20_000 },
      )
      .toMatchObject({
        worktreeId: expect.stringContaining(worktreeDirectoryName),
        threadId: expect.any(String),
        worktreeLabels: expect.arrayContaining([branchName]),
      });

    await expect(page.getByTestId("left-rail")).toContainText(branchName);
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(1);

    await page.getByTestId("create-thread-button").click();
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(2);

    const closeButtons = page.getByTestId("thread-tab-close");
    await closeButtons.nth(1).click();

    await expect(page.getByTestId("thread-tab-select")).toHaveCount(1);
  } finally {
    await closeDesktopApp(app);
    removeWorktree(repoRoot, createdWorktreePath, branchName);
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});
