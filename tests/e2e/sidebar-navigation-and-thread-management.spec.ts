import { expect, type Locator, test } from "@playwright/test";
import {
  closeDesktopApp,
  createThreadFromSidebar,
  ensureWorkspaceMode,
  focusChatThread,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

async function createAutoNamedThread(
  page: import("@playwright/test").Page,
): Promise<Locator> {
  await createThreadFromSidebar(page);
  const threadTabs = page.getByTestId("thread-tabs");
  const createdThread = threadTabs.getByTestId("thread-tab-select").last();
  await expect(createdThread).toBeVisible({ timeout: 15_000 });
  return createdThread;
}

async function selectThreadListItem(threadItem: Locator): Promise<void> {
  await threadItem.click();
  await threadItem.press("Enter");
}

test.fixme("creates and finds a thread from the flattened rail", async () => {
  // FIXME(imaginary-lamb): thread tab item detaches from DOM during click.
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

    await expect(page.getByTestId("left-sidebar")).toBeVisible();
    await expect(page.getByTestId("chat-first-layout")).toBeVisible();
    await expect(page.getByTestId("chat-transcript")).toBeVisible();
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
  }
});
