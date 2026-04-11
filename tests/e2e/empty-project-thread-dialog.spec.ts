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
  await expect(page.getByTestId("left-rail")).toBeVisible();
}

async function addAndSelectRepository(
  page: import("@playwright/test").Page,
  repositoryPath: string,
) {
  const expectedRepositoryPath = repositoryPath.replace(/^\/private/, "");

  await page.evaluate(async (targetPath) => {
    await window.pidesk.repositories.add(targetPath);
  }, repositoryPath);

  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const shell = await window.pidesk.shell.getSnapshot();
          return (shell.catalog.selection.repositoryId ?? "").replace(
            /^\/private/,
            "",
          );
        }),
      { timeout: 15_000 },
    )
    .toBe(expectedRepositoryPath);
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

function createFolderWorkspace(rootPath: string) {
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(path.join(rootPath, "notes.txt"), "plain folder\n");
}

test("creates a thread inline instead of opening a naming dialog", async () => {
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
    await addAndSelectRepository(page, repositoryPath);
    await expect(page.getByTestId("left-rail")).toContainText("EmptyProject", {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("dialog", { name: "Name your new thread" }),
    ).toHaveCount(0);

    await page.getByTestId("create-thread-button").click();

    const inlineInput = page.getByTestId("thread-inline-input");
    await expect(inlineInput).toBeVisible({ timeout: 15_000 });
    await inlineInput.fill("Inline Thread");
    await inlineInput.press("Enter");

    await expect(page.getByTestId("left-rail")).toContainText("Inline Thread");
    await expect(
      page.getByRole("dialog", { name: "Name your new thread" }),
    ).toHaveCount(0);
  } finally {
    await app.close();
    launchContext.cleanup();
    fs.rmSync(repoParent, { recursive: true, force: true });
  }
});

test("falls back to a generated thread name when inline naming is left blank", async () => {
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
    await addAndSelectRepository(page, repositoryPath);
    await expect(page.getByTestId("left-rail")).toContainText("EmptyProject", {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("dialog", { name: "Name your new thread" }),
    ).toHaveCount(0);

    await page.getByTestId("create-thread-button").click();
    const inlineInput = page.getByTestId("thread-inline-input");
    await expect(inlineInput).toBeVisible({ timeout: 15_000 });
    await inlineInput.focus();
    await inlineInput.press("Enter");

    await expect(page.getByTestId("left-rail")).toContainText(
      /Thread (Atlas|Ember|Nova|Quartz|Harbor)/,
      {
        timeout: 15_000,
      },
    );
  } finally {
    await app.close();
    launchContext.cleanup();
    fs.rmSync(repoParent, { recursive: true, force: true });
  }
});

test("opening a plain folder from the workspace button makes it the active project", async () => {
  test.setTimeout(60_000);

  const repoParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "pidesk-folder-workspace-"),
  );
  const folderPath = path.join(repoParent, "PlainWorkspace");
  createFolderWorkspace(folderPath);

  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-folder-workspace-",
  );

  try {
    await waitForShell(page);

    await page.evaluate(async (targetPath) => {
      await window.pidesk.repositories.add(targetPath);
    }, folderPath);

    const expectedFolderPath = folderPath.replace(/^\/private/, "");

    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const shell = await window.pidesk.shell.getSnapshot();
            return {
              repositoryId: (
                shell.catalog.selection.repositoryId ?? ""
              ).replace(/^\/private/, ""),
              worktreeId: shell.catalog.selection.worktreeId,
              rootPath: (shell.workspace?.rootPath ?? "").replace(
                /^\/private/,
                "",
              ),
              gitStatus: shell.git?.status ?? null,
            };
          }),
        { timeout: 15_000 },
      )
      .toEqual({
        repositoryId: expectedFolderPath,
        worktreeId: null,
        rootPath: expectedFolderPath,
        gitStatus: "not_repo",
      });

    await expect(page.getByTestId("left-rail")).toContainText(
      "PlainWorkspace",
      {
        timeout: 15_000,
      },
    );
    await expect(
      page.getByRole("heading", { name: "Not a git repository" }),
    ).toBeVisible();
  } finally {
    await app.close();
    launchContext.cleanup();
    fs.rmSync(repoParent, { recursive: true, force: true });
  }
});
