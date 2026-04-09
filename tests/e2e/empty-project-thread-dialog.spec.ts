import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { launchDesktopApp } from "./helpers/desktop-app";

async function waitForShell(page: import("@playwright/test").Page) {
  await page.waitForLoadState("domcontentloaded");
  await expect
    .poll(
      async () => {
        try {
          return await page.getByTestId("app-ready").count();
        } catch {
          return 0;
        }
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
  await expect(page.getByTestId("app-ready")).toBeVisible();
  await expect(page.getByTestId("left-rail")).toContainText("PiDesk");
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
  fs.writeFileSync(path.join(rootPath, "README.md"), "# Empty Repo\n");
  runGit(["add", "README.md"], rootPath);
  runGit(
    [
      "-c",
      "user.name=PiDesk Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "-m",
      "init",
    ],
    rootPath,
  );
}

test("opens the create-thread dialog only from the explicit New thread action", async () => {
  test.setTimeout(60_000);

  const repoParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "pidesk-empty-project-"),
  );
  const repositoryPath = path.join(repoParent, "EmptyProject");
  createRepository(repositoryPath);

  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-empty-project-",
  );

  try {
    await waitForShell(page);

    await page.evaluate(async (targetPath) => {
      const desktopWindow = window as typeof window & {
        pidesk: {
          repositories: {
            add(path: string): Promise<void>;
          };
        };
      };

      await desktopWindow.pidesk.repositories.add(targetPath);
    }, repositoryPath);

    const projectButton = page
      .getByTestId("left-rail")
      .getByText("EmptyProject")
      .first();

    const threadDialog = page.getByRole("dialog", {
      name: "Name your new thread",
    });

    await expect(projectButton).toBeVisible({ timeout: 15_000 });
    await projectButton.click();
    await expect(threadDialog).toHaveCount(0);

    const worktreeSection = page
      .getByTestId("worktree-section")
      .filter({ hasText: "main" })
      .first();

    await expect(worktreeSection).toBeVisible();
    await worktreeSection.getByTestId("create-thread-button").click();
    await expect(threadDialog).toBeVisible();
    await threadDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(threadDialog).toBeHidden();
  } finally {
    await app.close();
    launchContext.cleanup();
    fs.rmSync(repoParent, { recursive: true, force: true });
  }
});

test("confirms project removal before deleting it from the rail", async () => {
  test.setTimeout(60_000);

  const repoParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "pidesk-remove-project-"),
  );
  const repositoryPath = path.join(repoParent, "EmptyProject");
  createRepository(repositoryPath);

  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-remove-project-",
  );

  try {
    await waitForShell(page);

    await page.evaluate(async (targetPath) => {
      const desktopWindow = window as typeof window & {
        pidesk: {
          repositories: {
            add(path: string): Promise<void>;
          };
        };
      };

      await desktopWindow.pidesk.repositories.add(targetPath);
    }, repositoryPath);

    const projectText = page
      .getByTestId("left-rail")
      .getByText("EmptyProject")
      .first();
    const threadDialog = page.getByRole("dialog", {
      name: "Name your new thread",
    });

    await expect(projectText).toBeVisible({ timeout: 15_000 });
    await expect(threadDialog).toHaveCount(0);

    const projectRow = projectText.locator("xpath=ancestor::button[1]");

    await projectRow.click({ button: "right" });
    await page.getByRole("button", { name: "Remove" }).click();

    const removeDialog = page.getByRole("dialog", {
      name: "Remove project from rail?",
    });

    await expect(removeDialog).toBeVisible();
    await removeDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(removeDialog).toBeHidden();
    await expect(projectText).toBeVisible();

    await projectRow.click({ button: "right" });
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(removeDialog).toBeVisible();
    await removeDialog.getByRole("button", { name: "Remove Project" }).click();

    await expect(projectText).toHaveCount(0);
    await expect(page.getByText("Project removed from rail")).toBeVisible();
  } finally {
    await app.close();
    launchContext.cleanup();
    fs.rmSync(repoParent, { recursive: true, force: true });
  }
});
