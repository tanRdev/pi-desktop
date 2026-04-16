import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  ensureWorkspaceMode,
  getCurrentBranchName,
  launchDesktopApp,
  removeWorktree,
  repoRoot,
  waitForAppReady,
} from "./helpers/desktop-app";

test("creates a session from the sidebar and keeps tabs in sync per session", async () => {
  test.setTimeout(90_000);

  const homeDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-desktop-e2e-session-tabs-"),
  );
  const userDataDir = path.join(homeDir, ".pi-desktop-test-user-data");
  const branchName = `feature/e2e-session-${Date.now()}`;
  const worktreeDirectoryName = branchName.replace(/[/]+/g, "-");
  const createdWorktreePath = path.join(
    homeDir,
    ".worktrees",
    "pi-desktop",
    worktreeDirectoryName,
  );
  const defaultBranchName = getCurrentBranchName();

  fs.mkdirSync(userDataDir, { recursive: true });

  const { app, page } = await launchDesktopApp("pi-desktop-e2e-session-tabs-", {
    homeDir,
    userDataDir,
  });

  try {
    await waitForAppReady(page);
    await ensureWorkspaceMode(page);

    const workspaceRow = page.getByRole("button", { name: /pi-desktop/i });
    await workspaceRow.hover();
    await page.getByTestId("create-session-button").click();
    await expect(
      page.getByRole("dialog", { name: "Create session" }),
    ).toBeVisible();
    await page.getByTestId("worktree-branch-input").fill(branchName);
    await page.getByRole("button", { name: "Create" }).click();

    await expect
      .poll(
        async () => {
          const snapshot = await page.evaluate(async () => {
            return window.piDesktop.shell.getSnapshot();
          });

          return {
            worktreeId: snapshot.catalog.selection.worktreeId,
            threadId: snapshot.catalog.selection.threadId,
            worktreeLabels:
              snapshot.catalog.repositories[0]?.worktrees.map(
                (worktree) => worktree.label,
              ) ?? [],
          };
        },
        { timeout: 20_000 },
      )
      .toMatchObject({
        worktreeId: expect.stringContaining(worktreeDirectoryName),
        threadId: expect.any(String),
        worktreeLabels: expect.arrayContaining([branchName]),
      });

    const createdSessionRow = page
      .getByTestId("session-row")
      .filter({ hasText: branchName });
    const defaultSessionRow = page
      .getByTestId("session-row")
      .filter({ hasText: defaultBranchName });

    await expect(page.getByTestId("left-sidebar")).toContainText(branchName);
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(1);

    await page.getByTestId("create-thread-button").click();
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(2);

    await defaultSessionRow.click();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const snapshot = await window.piDesktop.shell.getSnapshot();
          return snapshot.catalog.selection.worktreeId;
        }),
      )
      .toBe(repoRoot);
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(1);

    await createdSessionRow.click();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const snapshot = await window.piDesktop.shell.getSnapshot();
          return snapshot.catalog.selection.worktreeId;
        }),
      )
      .toContain(worktreeDirectoryName);
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(2);
  } finally {
    await closeDesktopApp(app);
    removeWorktree(repoRoot, createdWorktreePath, branchName);
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});
