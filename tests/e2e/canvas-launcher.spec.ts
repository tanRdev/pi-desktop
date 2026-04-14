import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  getContextPanelAction,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

test("toggles the side panel and opens terminal content from the title bar", async () => {
  test.setTimeout(45_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-launcher-overlay-",
  );

  try {
    await waitForAppReady(page);
    await expect(page.getByTestId("workspace-context-panel")).toHaveCount(0);
    await getContextPanelAction(page, "Launcher").click();
    await expect(page.getByTestId("workspace-context-panel")).toHaveCount(0);

    await getContextPanelAction(page, "Launcher").click();
    await expect(page.getByTestId("workspace-context-panel")).toHaveCount(0);

    await getContextPanelAction(page, "Terminal").click();
    await expect(page.getByTestId("workspace-context-panel")).toBeVisible();
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
  }
});
