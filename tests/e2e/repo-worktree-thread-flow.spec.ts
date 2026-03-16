import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { _electron as electron, expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const desktopMainEntry = path.join(repoRoot, "apps/desktop/out/main/index.js");

function removeWorktree(repoPath: string, worktreePath: string, branchName: string): void {
  spawnSync("git", ["worktree", "remove", "-f", worktreePath], {
    cwd: repoPath,
    encoding: "utf8",
  });
  spawnSync("git", ["branch", "-D", branchName], {
    cwd: repoPath,
    encoding: "utf8",
  });
}

test("creates a worktree, creates a thread, and restores selection after relaunch", async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "pidesk-e2e-home-"));
  const branchName = `feature/e2e-${Date.now()}`;
  const worktreeDirectoryName = branchName.replace(/[\\/]+/g, "-");
  const createdWorktreePath = path.join(homeDir, ".worktrees", "PiDesk", worktreeDirectoryName);

  const launchApp = () =>
    electron.launch({
      args: [desktopMainEntry],
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME: homeDir,
        NODE_ENV: "test",
        PIDESK_AGENT_MODE: "mock",
      },
    });

  const app = await launchApp();

  try {
    const page = await app.firstWindow();

    await expect(page.getByTestId("app-ready")).toBeVisible();
    await expect(page.getByTestId("app-title")).toHaveText("π");
    await expect(page.getByTestId("agent-status")).toHaveText("ready", { timeout: 10_000 });

    await page.getByRole("button", { name: "Create worktree" }).click();
    await page.getByTestId("worktree-branch-input").fill(branchName);
    await page.getByRole("button", { name: "Create" }).click();

    await expect(
      page.getByTestId("current-worktree-label"),
      { timeout: 15_000 },
    ).toHaveText(branchName);
    await expect(page.getByTestId("agent-status")).toHaveText("ready", { timeout: 10_000 });

    await page.getByRole("button", { name: "Create thread" }).click();
    await expect(page.getByTestId("current-thread-title")).toHaveText("New thread");

    await app.close();

    const relaunchedApp = await launchApp();
    try {
      const relaunchedPage = await relaunchedApp.firstWindow();
      await expect(relaunchedPage.getByTestId("app-ready")).toBeVisible();
      await expect(relaunchedPage.getByTestId("agent-status")).toHaveText("ready", { timeout: 10_000 });
      await expect(relaunchedPage.getByTestId("current-worktree-label")).toHaveText(
        branchName,
      );
      await expect(relaunchedPage.getByTestId("current-thread-title")).toHaveText(
        "New thread",
      );
    } finally {
      await relaunchedApp.close();
    }
  } finally {
    removeWorktree(repoRoot, createdWorktreePath, branchName);
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});
