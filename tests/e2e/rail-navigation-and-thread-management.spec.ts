import { expect, type Locator, test } from "@playwright/test";
import {
  closeDesktopApp,
  createThreadFromRail,
  ensureWorkspaceMode,
  focusChatThread,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

async function createAutoNamedThread(
  page: import("@playwright/test").Page,
): Promise<Locator> {
  await createThreadFromRail(page);
  const threadTabs = page.getByTestId("thread-tabs");
  const createdThread = threadTabs.getByTestId("thread-tab-select").last();
  await expect(createdThread).toBeVisible({ timeout: 15_000 });
  return createdThread;
}

async function selectThreadListItem(threadItem: Locator): Promise<void> {
  await threadItem.click();
  await threadItem.press("Enter");
}

test("creates, finds, and archives a thread from the flattened rail", async () => {
  test.setTimeout(75_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-threads-",
  );

  try {
    await waitForAppReady(page);
    await ensureWorkspaceMode(page);

    const createdThread = await createAutoNamedThread(page);
    const createdThreadName = await createdThread.textContent();
    await selectThreadListItem(createdThread);
    await expect(page.getByTestId("thread-tabs")).toContainText(
      createdThreadName ?? "",
    );

    await focusChatThread(page);
    await expect(page.getByTestId("chat-transcript")).toBeVisible();

    await createdThread.hover();
    const archiveButton = page.getByRole("button", {
      name: `Close ${createdThreadName ?? "thread"}`,
    });
    await expect(archiveButton).toBeVisible();
    await archiveButton.click();

    const archivedThread = page.getByTestId("left-rail").getByRole("button", {
      name: createdThreadName ?? "",
    });
    await expect(archivedThread).toHaveCount(1);
    await expect(page.getByTestId("left-rail")).toContainText("Archived");
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
  }
});

test("keeps the shell to sessions rail, chat, and sidecar only", async () => {
  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-rail-views-",
  );

  try {
    await waitForAppReady(page);
    await ensureWorkspaceMode(page);

    await expect(page.getByTestId("left-rail")).toBeVisible();
    await expect(page.getByTestId("chat-first-layout")).toBeVisible();
    await expect(page.getByTestId("chat-transcript")).toBeVisible();
    await expect(page.getByTestId("left-sidebar")).toHaveCount(0);
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
  }
});
