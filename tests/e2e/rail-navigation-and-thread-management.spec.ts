import { expect, type Locator, test } from "@playwright/test";
import {
  ensureWorkspaceMode,
  focusChatThread,
  getCurrentBranchName,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

async function getThreadTitles(worktreeSection: Locator): Promise<string[]> {
  const titles = await worktreeSection
    .getByTestId("thread-list-item")
    .locator("span")
    .allTextContents();

  return titles.map((title) => title.trim()).filter(Boolean);
}

async function getCurrentThreadTitle(page: import("@playwright/test").Page) {
  return (await page.getByTestId("current-thread-title").textContent())?.trim();
}

async function selectThreadListItem(threadItem: Locator): Promise<void> {
  await threadItem.click();
  await threadItem.press("Enter");
}

test("creates, renames, finds, and closes a thread across workspace rail views", async () => {
  test.setTimeout(75_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-threads-",
  );

  try {
    await waitForAppReady(page);
    await ensureWorkspaceMode(page);

    const activeWorktreeSection = page
      .locator(
        `[data-testid="worktree-section"][data-worktree-label="${getCurrentBranchName()}"]`,
      )
      .first();

    await expect(activeWorktreeSection).toBeVisible();

    const initialThreadTitles = await getThreadTitles(activeWorktreeSection);
    const initialCurrentThreadTitle = await getCurrentThreadTitle(page);
    await expect(initialCurrentThreadTitle).toBeTruthy();
    const initialThreadCount = await activeWorktreeSection
      .getByTestId("thread-list-item")
      .count();

    await activeWorktreeSection.getByTestId("create-thread-button").click();

    await expect
      .poll(
        async () =>
          await activeWorktreeSection.getByTestId("thread-list-item").count(),
        { timeout: 10_000 },
      )
      .toBe(initialThreadCount + 1);

    let createdThreadTitle: string | undefined;

    await expect
      .poll(async () => {
        const nextTitles = await getThreadTitles(activeWorktreeSection);
        createdThreadTitle = nextTitles.find(
          (title) =>
            !initialThreadTitles.includes(title) &&
            title !== initialCurrentThreadTitle &&
            title !== "Current thread",
        );
        return createdThreadTitle ?? null;
      })
      .not.toBeNull();

    const createdThread = activeWorktreeSection
      .getByTestId("thread-list-item")
      .filter({ hasText: String(createdThreadTitle) })
      .first();

    await createdThread.hover();
    await createdThread.getByTestId("thread-rename-button").click();

    const renameInput = page.getByTestId("thread-rename-input");
    await expect(renameInput).toBeVisible();
    await renameInput.fill("QA Thread");
    await renameInput.press("Enter");

    const renamedThreadInExplorer = activeWorktreeSection
      .getByTestId("thread-list-item")
      .filter({ hasText: /qa thread/i })
      .first();

    await expect(renamedThreadInExplorer).toBeVisible();
    await selectThreadListItem(renamedThreadInExplorer);
    await expect(page.getByTestId("current-thread-title")).toHaveText(
      /qa thread/i,
    );

    await expect(renamedThreadInExplorer).toBeVisible();
    await selectThreadListItem(renamedThreadInExplorer);
    await expect(page.getByTestId("current-thread-title")).toHaveText(
      /qa thread/i,
    );
    await focusChatThread(page);

    await expect(page.getByTestId("chat-transcript")).toBeVisible();

    const closeButton = renamedThreadInExplorer.getByTestId(
      "thread-close-button",
    );
    await closeButton.focus();
    await closeButton.click();

    await expect(
      activeWorktreeSection
        .getByTestId("thread-list-item")
        .filter({ hasText: /qa thread/i }),
    ).toHaveCount(0);
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});

test("keeps the shell to sessions rail, chat, and sidecar only", async () => {
  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-rail-views-",
  );

  try {
    await waitForAppReady(page);
    await ensureWorkspaceMode(page);

    await expect(page.getByTestId("left-rail")).toBeVisible();
    await expect(page.getByTestId("chat-first-layout")).toBeVisible();
    await expect(page.getByTestId("chat-transcript")).toBeVisible();
    await expect(page.getByTestId("left-sidebar")).toHaveCount(0);
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
