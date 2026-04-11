import { expect, test } from "@playwright/test";
import {
  focusChatThread,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

test("streams a real Pi CLI reply through the desktop chat", async () => {
  test.setTimeout(90_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-real-pi-",
    {
      agentMode: "cli",
    },
  );

  try {
    await waitForAppReady(page);
    await page.getByTestId("create-thread-button").click();
    await expect(page.getByTestId("thread-inline-input")).toBeVisible();
    await page.getByTestId("thread-inline-input").fill("Real Pi Thread");
    await page.getByTestId("thread-inline-input").press("Enter");
    await focusChatThread(page);

    await page
      .getByTestId("chat-input")
      .fill("Reply with exactly: Pidesk real cli ok");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("chat-transcript")).toContainText(
      "Reply with exactly: Pidesk real cli ok",
      {
        timeout: 20_000,
      },
    );
    await expect(page.getByTestId("chat-transcript")).toContainText(
      "Pidesk real cli ok",
      {
        timeout: 60_000,
      },
    );
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
