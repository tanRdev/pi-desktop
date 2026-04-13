import { expect, type Locator, test } from "@playwright/test";
import {
  ensureWorkspaceMode,
  focusChatThread,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

async function createAutoNamedThread(
  page: import("@playwright/test").Page,
): Promise<Locator> {
  await page.getByTestId("create-thread-button").click();
  const leftRail = page.getByTestId("left-rail");
  const createdThread = leftRail.getByTestId("thread-row").first();
  await expect(createdThread).toBeVisible({ timeout: 15_000 });
  return createdThread.getByRole("button").first();
}

async function selectThreadListItem(threadItem: Locator): Promise<void> {
  await threadItem.click();
  await threadItem.press("Enter");
}

test("creates, finds, and archives a thread from the flattened rail", async () => {
  test.setTimeout(75_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-threads-",
  );

  try {
    await waitForAppReady(page);
    await ensureWorkspaceMode(page);

    const createdThread = await createAutoNamedThread(page);
    const createdThreadName = await createdThread.textContent();
    await selectThreadListItem(createdThread);
    await expect(page.getByTestId("left-rail")).toContainText(
      createdThreadName ?? "",
    );

    await focusChatThread(page);
    await expect(page.getByTestId("chat-transcript")).toBeVisible();

    await createdThread.hover();
    const archiveButton = createdThread.getByTestId("thread-archive-button");
    await expect(archiveButton).toBeVisible();
    await archiveButton.click();

    const archivedThread = page.getByTestId("left-rail").getByRole("button", {
      name: createdThreadName ?? "",
    });
    await expect(archivedThread).toHaveCount(1);
    await expect(page.getByTestId("left-rail")).toContainText("Archived");
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
