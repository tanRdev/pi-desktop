import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  createThreadFromSidebar,
  launchDesktopApp,
} from "./helpers/desktop-app";

async function waitForShell(page: import("@playwright/test").Page) {
  await page.waitForLoadState("domcontentloaded");
  await expect
    .poll(
      () =>
        page
          .getByTestId("app-ready")
          .count()
          .then(
            (count) => count,
            () => 0,
          ),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
  await expect(page.getByTestId("app-ready")).toBeVisible();
  await expect(page.getByTestId("left-sidebar")).toBeVisible();
}

async function addAndSelectRepository(
  page: import("@playwright/test").Page,
  repositoryPath: string,
) {
  const expectedRepositoryPath = repositoryPath.replace(/^\/private/, "");

  await page.evaluate(async (targetPath) => {
    await window.piDesktop.repositories.add(targetPath);
  }, repositoryPath);

  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const shell = await window.piDesktop.shell.getSnapshot();
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

function createFolderWorkspace(rootPath: string) {
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(path.join(rootPath, "notes.txt"), "plain folder\n");
}

test("creates a thread inline instead of opening a naming dialog", async () => {
  test.setTimeout(60_000);

  const repoParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-desktop-empty-project-"),
  );
  const repositoryPath = path.join(repoParent, "EmptyProject");
  createRepository(repositoryPath);

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-empty-project-",
  );

  try {
    await waitForShell(page);
    await addAndSelectRepository(page, repositoryPath);
    await expect(page.getByTestId("left-sidebar")).toContainText(
      "EmptyProject",
      {
        timeout: 15_000,
      },
    );
    await expect(
      page.getByRole("dialog", { name: "Name your new thread" }),
    ).toHaveCount(0);

    await createThreadFromSidebar(page);
    await expect(page.getByTestId("thread-inline-input")).toHaveCount(0);
    await expect(page.getByTestId("thread-tabs")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("dialog", { name: "Name your new thread" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("thread-tabs")).toContainText(/\S+/);
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
    fs.rmSync(repoParent, { recursive: true, force: true });
  }
});

test("opening a plain folder from the workspace button makes it the active project", async () => {
  test.setTimeout(60_000);

  const repoParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-desktop-folder-workspace-"),
  );
  const folderPath = path.join(repoParent, "PlainWorkspace");
  createFolderWorkspace(folderPath);

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-folder-workspace-",
  );

  try {
    await waitForShell(page);

    await page.evaluate(async (targetPath) => {
      await window.piDesktop.repositories.add(targetPath);
      window.location.reload();
    }, folderPath);

    await waitForShell(page);

    const expectedFolderPath = folderPath.replace(/^\/private/, "");

    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const shell = await window.piDesktop.shell.getSnapshot();
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
        worktreeId: expectedFolderPath,
        rootPath: expectedFolderPath,
        gitStatus: "not_repo",
      });

    await expect(page.getByTestId("left-sidebar")).toContainText(
      "PlainWorkspace",
      {
        timeout: 15_000,
      },
    );
    await expect(page.getByTestId("workspace-switch-loader")).toHaveCount(0);
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
    fs.rmSync(repoParent, { recursive: true, force: true });
  }
});
