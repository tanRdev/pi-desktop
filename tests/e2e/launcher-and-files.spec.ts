import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  getContextPanelAction,
  getWorkspacePrimarySurface,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

test("opens a terminal surface from the title bar", async () => {
  test.setTimeout(45_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-launcher-",
  );

  try {
    await waitForAppReady(page);
    const contextPanel = getWorkspacePrimarySurface(page);

    await getContextPanelAction(page, "Terminal").click();
    await expect(contextPanel).toBeVisible();
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
  }
});
