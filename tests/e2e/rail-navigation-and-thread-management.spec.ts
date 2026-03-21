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

async function getSidebarWidth(sidebar: Locator): Promise<number> {
  return await sidebar.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
}

async function getCurrentThreadTitle(page: import("@playwright/test").Page) {
  return (await page.getByTestId("current-thread-title").textContent())?.trim();
}

async function selectThreadListItem(threadItem: Locator): Promise<void> {
  await threadItem.click();
  await threadItem.press("Enter");
}

test("creates, renames, finds, and closes a thread across workspace rail views", async () => {
  test.setTimeout(45_000);

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

    await page.getByRole("button", { name: "SEARCH" }).click();

    const workspaceSearch = page.getByRole("searchbox", {
      name: "Search worktrees or threads",
    });
    await workspaceSearch.fill("QA Thread");

    const searchResult = page
      .getByTestId("left-sidebar")
      .getByRole("button", { name: /QA Thread/i })
      .first();
    await expect(searchResult).toBeVisible();
    await workspaceSearch.fill(String(createdThreadTitle));
    await expect(
      page.getByTestId("left-sidebar").getByRole("button", {
        name: new RegExp(String(createdThreadTitle), "i"),
      }),
    ).toHaveCount(0);

    await workspaceSearch.fill("QA Thread");
    await expect(searchResult).toBeVisible();
    await searchResult.click();
    await page.getByRole("button", { name: "EXPLORER" }).click();
    await expect(renamedThreadInExplorer).toBeVisible();
    await selectThreadListItem(renamedThreadInExplorer);
    await expect(page.getByTestId("current-thread-title")).toHaveText(
      /qa thread/i,
    );
    await focusChatThread(page);

    await page.getByRole("button", { name: "DEBUG" }).click();
    const debugEntry = page
      .getByTestId("left-sidebar")
      .getByRole("button", { name: /QA Thread/i })
      .first();
    await expect(debugEntry).toBeVisible();
    await expect(debugEntry).toContainText(/ready/i);

    await page.getByRole("button", { name: "EXPLORER" }).click();

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

    await page.getByRole("button", { name: "SEARCH" }).click();
    await workspaceSearch.fill("QA Thread");
    await expect(
      page
        .getByTestId("left-sidebar")
        .getByRole("button", { name: /QA Thread/i }),
    ).toHaveCount(0);
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});

test("toggles the workspace sidebar and renders source, debug, and extensions rail surfaces", async () => {
  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-rail-views-",
  );

  try {
    await waitForAppReady(page);
    await ensureWorkspaceMode(page);

    const sidebar = page.getByTestId("left-sidebar");
    await expect.poll(() => getSidebarWidth(sidebar)).toBeGreaterThan(0);

    await page
      .getByRole("button", { name: "Toggle workspace sidebar" })
      .click();
    await expect.poll(() => getSidebarWidth(sidebar)).toBe(0);

    await page
      .getByRole("button", { name: "Toggle workspace sidebar" })
      .click();
    await expect.poll(() => getSidebarWidth(sidebar)).toBeGreaterThan(0);

    await page.getByRole("button", { name: "SOURCE" }).click();
    await expect(sidebar).toContainText(/Dirty\s*\d+/);
    await expect(sidebar).toContainText(/Staged\s*\d+/);
    await expect(sidebar).toContainText(/Modified\s*\d+/);
    await expect(sidebar).toContainText(/Untracked\s*\d+/);
    await expect(
      sidebar.getByRole("button", {
        name: new RegExp(getCurrentBranchName(), "i"),
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "DEBUG" }).click();
    await expect(sidebar).toContainText(/Live\s*\d+/);
    await expect(sidebar).toContainText(/Ready\s*\d+/);
    await expect(sidebar).toContainText(/Errors\s*\d+/);
    await expect(sidebar).toContainText(/Offline\s*\d+/);
    await expect(
      sidebar
        .getByRole("button", { name: /current thread|qa thread/i })
        .first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "EXT" }).click();
    const extensionCards = sidebar.locator("div").filter({
      hasText: /Explorer Surface|Search Index|Source Inspector|Runtime Monitor/,
    });

    await expect(
      extensionCards.filter({ hasText: /Explorer Surface/ }).first(),
    ).toContainText(/(Mounted|Idle)/);
    await expect(
      extensionCards.filter({ hasText: /Search Index/ }).first(),
    ).toContainText(/(Ready|Empty)/);
    await expect(
      extensionCards.filter({ hasText: /Source Inspector/ }).first(),
    ).toContainText(/(Ready|Degraded)/);
    await expect(
      extensionCards.filter({ hasText: /Runtime Monitor/ }).first(),
    ).toContainText(/(Attached|Idle)/);
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
