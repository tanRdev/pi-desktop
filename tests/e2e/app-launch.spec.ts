import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  createThreadFromRail,
  focusChatThread,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

test("launches the shell and streams a mock agent reply", async () => {
  test.setTimeout(45_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-launch-",
  );

  try {
    await waitForAppReady(page);

    await expect(page.getByTestId("left-rail")).toBeVisible();
    const tabButtonsBefore = await page
      .getByTestId("thread-tab-select")
      .count();
    await createThreadFromRail(page);
    await expect(page.getByTestId("thread-tab-select")).toHaveCount(
      tabButtonsBefore + 1,
    );

    await focusChatThread(page);

    await page
      .getByTestId("chat-input")
      .fill("Summarize the current workspace");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("chat-transcript")).toContainText(
      "Pi Desktop mock assistant received: Summarize the current workspace",
    );
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
  }
});
