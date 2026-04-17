import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  ensureWorkspaceMode,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

function workspaceRow(page: import("@playwright/test").Page, name: string) {
  return page.getByTestId("workspace-row").filter({ hasText: name });
}

function runGit(args: string[], cwd: string) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
}

function createRepository(rootPath: string) {
  fs.mkdirSync(rootPath, { recursive: true });
  runGit(["init", "-b", "main"], rootPath);
  fs.writeFileSync(
    path.join(rootPath, "README.md"),
    `# ${path.basename(rootPath)}\n`,
  );
  runGit(["add", "README.md"], rootPath);
  runGit(
    [
      "-c",
      "user.name=Pi Desktop Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "-m",
      "init",
    ],
    rootPath,
  );
}

test("keeps sessions and threads isolated per workspace and recovers empty workspaces", async () => {
  test.setTimeout(90_000);

  const repoParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-desktop-multi-workspace-"),
  );
  const alphaPath = path.join(repoParent, "AlphaWorkspace");
  const betaPath = path.join(repoParent, "BetaWorkspace");
  createRepository(alphaPath);
  createRepository(betaPath);

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-multi-workspace-",
  );

  try {
    await waitForAppReady(page);
    await ensureWorkspaceMode(page);

    await page.evaluate(
      async ({ alpha, beta }) => {
        await window.piDesktop.repositories.add(alpha);
        await window.piDesktop.repositories.add(beta);
      },
      { alpha: alphaPath, beta: betaPath },
    );

    await expect
      .poll(
        async () => {
          const shell = await page.evaluate(async () =>
            window.piDesktop.shell.getSnapshot(),
          );
          return shell.catalog.repositories.map(
            (repository) => repository.name,
          );
        },
        { timeout: 15_000 },
      )
      .toEqual(expect.arrayContaining(["AlphaWorkspace", "BetaWorkspace"]));

    await expect(page.getByTestId("left-sidebar")).toContainText(
      "AlphaWorkspace",
    );
    await expect(page.getByTestId("left-sidebar")).toContainText(
      "BetaWorkspace",
    );

    await workspaceRow(page, "AlphaWorkspace").click();

    await expect(page.getByTestId("workspace-switch-loader")).toHaveCount(0);

    await expect(page.getByTestId("left-sidebar")).toContainText(
      "AlphaWorkspace",
    );
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(1);

    await page.getByTestId("create-thread-button").click();
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(2);

    const closeButtons = page.getByTestId("thread-tab-close");
    await closeButtons.nth(1).click();
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(1);
    await page.getByTestId("thread-tab-close").click();
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(0);
    await expect(page.getByTestId("create-thread-button")).toBeVisible();

    await workspaceRow(page, "BetaWorkspace").click();

    await expect(page.getByTestId("workspace-switch-loader")).toHaveCount(0);

    await expect(page.getByTestId("left-sidebar")).toContainText(
      "BetaWorkspace",
    );
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(1);

    await workspaceRow(page, "AlphaWorkspace").click();

    await expect(page.getByTestId("thread-tab-select")).toHaveCount(0);
    await page.getByTestId("create-thread-button").click();
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(1);

    await expect
      .poll(
        async () => {
          const shell = await page.evaluate(async () =>
            window.piDesktop.shell.getSnapshot(),
          );

          return shell.catalog.repositories.map((repository) => ({
            name: repository.name,
            openThreads: repository.worktrees.flatMap(
              (worktree) => worktree.threads,
            ).length,
          }));
        },
        { timeout: 15_000 },
      )
      .toEqual(
        expect.arrayContaining([
          { name: "AlphaWorkspace", openThreads: 1 },
          { name: "BetaWorkspace", openThreads: 1 },
        ]),
      );
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
    fs.rmSync(repoParent, { recursive: true, force: true });
  }
});
