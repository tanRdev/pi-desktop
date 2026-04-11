import { expect, test } from "@playwright/test";
import {
  focusChatThread,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

test("launches the shell and streams a mock agent reply", async () => {
  test.setTimeout(45_000);

  const { app, page, launchContext } =
    await launchDesktopApp("pidesk-e2e-launch-");

  try {
    await waitForAppReady(page);

    await expect(page.getByTestId("left-rail")).toBeVisible();
    await page.getByTestId("create-thread-button").click();
    await expect(page.getByTestId("thread-inline-input")).toBeVisible();
    await page.getByTestId("thread-inline-input").fill("Launch Thread");
    await page.getByTestId("thread-inline-input").press("Enter");

    await focusChatThread(page);

    await page
      .getByTestId("chat-input")
      .fill("Summarize the current workspace");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("chat-transcript")).toContainText(
      "PiDesk mock assistant received: Summarize the current workspace",
    );
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
