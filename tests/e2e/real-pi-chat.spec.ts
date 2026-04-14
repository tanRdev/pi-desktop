import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  createThreadFromRail,
  focusChatThread,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

const shouldRunRealCliE2E = process.env.PI_DESKTOP_RUN_REAL_CLI_E2E === "1";

test.skip(
  !shouldRunRealCliE2E,
  "Set PI_DESKTOP_RUN_REAL_CLI_E2E=1 to opt into live Pi CLI coverage.",
);

test("streams a real Pi CLI reply through the desktop chat", async () => {
  test.setTimeout(90_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-real-pi-",
    {
      agentMode: "cli",
    },
  );

  try {
    await waitForAppReady(page);
    await createThreadFromRail(page);
    await expect(page.getByTestId("thread-tabs")).toContainText("Echo");
    await focusChatThread(page);

    await page
      .getByTestId("chat-input")
      .fill("Reply with exactly: Pi Desktop real cli ok");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("chat-transcript")).toContainText(
      "Reply with exactly: Pi Desktop real cli ok",
      {
        timeout: 20_000,
      },
    );
    await expect(page.getByTestId("chat-transcript")).toContainText(
      "Pi Desktop real cli ok",
      {
        timeout: 60_000,
      },
    );
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
  }
});
