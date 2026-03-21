import { expect, test } from "@playwright/test";
import {
  focusChatThread,
  getCurrentBranchName,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

test("launches the shell and streams a mock agent reply", async () => {
  const { app, page, launchContext } =
    await launchDesktopApp("pidesk-e2e-launch-");

  try {
    await waitForAppReady(page);

    await expect(page.getByTestId("titlebar-project-name")).toHaveText(
      "PiDesk",
    );
    await expect(page.getByTestId("current-worktree-label")).toHaveText(
      getCurrentBranchName(),
    );

    await focusChatThread(page);

    await page
      .getByTestId("chat-input")
      .fill("Summarize the current workspace");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("agent-status")).toHaveText("ready", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("chat-transcript")).toContainText(
      "PiDesk mock assistant received: Summarize the current workspace",
    );
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
