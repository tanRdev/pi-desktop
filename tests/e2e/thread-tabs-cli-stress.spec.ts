import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  createThreadFromRail,
  focusChatThread,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

test.skip(
  process.env.PI_DESKTOP_RUN_REAL_CLI_E2E !== "1",
  "Set PI_DESKTOP_RUN_REAL_CLI_E2E=1 to opt into live Pi CLI coverage.",
);

test("stress-tests thread tabs in cli mode without surfacing socket attach errors", async () => {
  test.setTimeout(120_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-thread-tabs-cli-",
    {
      agentMode: "cli",
    },
  );

  try {
    await waitForAppReady(page);

    const threadTabs = page.getByTestId("thread-tabs");
    const transcript = page.getByTestId("chat-transcript");

    await expect(threadTabs.getByTestId("thread-tab-select")).toHaveCount(1);

    await createThreadFromRail(page);
    await createThreadFromRail(page);
    await expect(threadTabs.getByTestId("thread-tab-select")).toHaveCount(3);

    const tabButtons = threadTabs.getByTestId("thread-tab-select");

    await tabButtons.nth(0).click();
    await tabButtons.nth(2).click();
    await tabButtons.nth(1).click();
    await tabButtons.nth(2).click();

    await focusChatThread(page);
    await page
      .getByTestId("chat-input")
      .fill("Reply with exactly: cli tabs ok");
    await page.getByTestId("chat-send").click();

    await expect(transcript).toContainText("Reply with exactly: cli tabs ok", {
      timeout: 20_000,
    });

    await expect(page.getByText(/^ERROR$/)).toHaveCount(0);
    await expect(transcript).toContainText("cli tabs ok", {
      timeout: 60_000,
    });
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
  }
});
