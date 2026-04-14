import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  createThreadFromRail,
  focusChatThread,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

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
  fs.writeFileSync(path.join(rootPath, "README.md"), "# E2E Repo\n");
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

async function getActiveThreadAndModel(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const shell = await window.piDesktop.shell.getSnapshot();
    const agent = await window.piDesktop.agent.getSnapshot();

    return {
      threadId: shell.catalog.selection.threadId,
      currentProviderId: agent.currentProviderId ?? null,
      currentModelId: agent.currentModelId ?? null,
      threadCount:
        shell.catalog.repositories[0]?.worktrees[0]?.threads.filter(
          (thread) => thread.isArchived === false,
        ).length ?? 0,
    };
  });
}

test("switches models while idle without changing the active thread", async () => {
  test.setTimeout(90_000);

  const repoParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-desktop-model-switch-e2e-"),
  );
  const repositoryPath = path.join(repoParent, "ModelSwitchRepo");
  createRepository(repositoryPath);

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-model-switch-",
  );

  try {
    await waitForAppReady(page);
    await addAndSelectRepository(page, repositoryPath);
    await createThreadFromRail(page);
    await focusChatThread(page);

    await expect
      .poll(
        async () => {
          const state = await getActiveThreadAndModel(page);

          return {
            hasThreadId: Boolean(state.threadId),
            currentProviderId: state.currentProviderId,
            currentModelId: state.currentModelId,
            threadCount: state.threadCount,
          };
        },
        {
          timeout: 15_000,
        },
      )
      .toEqual({
        hasThreadId: true,
        currentProviderId: "google",
        currentModelId: "gemini-2.5-pro",
        threadCount: 1,
      });

    const initialState = await getActiveThreadAndModel(page);
    expect(initialState.threadId).toBeTruthy();
    expect(initialState.currentProviderId).toBe("google");
    expect(initialState.currentModelId).toBe("gemini-2.5-pro");
    expect(initialState.threadCount).toBe(1);

    await expect
      .poll(
        async () => {
          const trigger = page.getByTestId("model-selector-trigger");

          return {
            text: (await trigger.textContent())?.trim() ?? "",
            disabled: await trigger.isDisabled(),
          };
        },
        {
          timeout: 15_000,
        },
      )
      .toEqual({
        text: "Gemini 2.5 Pro",
        disabled: false,
      });

    await page.getByTestId("model-selector-trigger").click();
    await expect(
      page.getByTestId("model-option-google-gemini-2.5-flash"),
    ).toBeVisible();
    await page.getByTestId("model-option-google-gemini-2.5-flash").click();

    await expect(page.getByTestId("model-selector-trigger")).toContainText(
      "Gemini 2.5 Flash",
    );

    await expect
      .poll(() => getActiveThreadAndModel(page), {
        timeout: 15_000,
      })
      .toEqual({
        threadId: initialState.threadId,
        currentProviderId: "google",
        currentModelId: "gemini-2.5-flash",
        threadCount: 1,
      });
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
    fs.rmSync(repoParent, { recursive: true, force: true });
  }
});

test("shows project-local slash commands in prompt autocomplete", async () => {
  test.setTimeout(90_000);

  const repoParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-desktop-slash-menu-e2e-"),
  );
  const repositoryPath = path.join(repoParent, "SlashMenuRepo");
  const localCommandDir = path.join(repositoryPath, ".pi", "agent", "commands");

  createRepository(repositoryPath);
  fs.mkdirSync(localCommandDir, { recursive: true });
  fs.writeFileSync(
    path.join(localCommandDir, "deploy.md"),
    "# Deploy\n\nShip the current app.",
    "utf8",
  );

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-slash-menu-",
  );

  try {
    await waitForAppReady(page);
    await addAndSelectRepository(page, repositoryPath);
    await createThreadFromRail(page);
    await focusChatThread(page);

    await page.getByTestId("chat-input").fill("/dep");

    const autocomplete = page.getByRole("listbox");
    await expect(autocomplete).toBeVisible();
    await expect(autocomplete).toContainText("Commands");
    await expect(autocomplete).toContainText("deploy");
    await expect(autocomplete).toContainText("/deploy");
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
    fs.rmSync(repoParent, { recursive: true, force: true });
  }
});
