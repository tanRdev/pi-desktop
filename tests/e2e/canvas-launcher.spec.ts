import { expect, test } from "@playwright/test";
import {
  getContextPanelAction,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

test("opens launcher as an overlay and dismisses it on close or selection", async () => {
  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-launcher-overlay-",
  );

  try {
    await waitForAppReady(page);
    await getContextPanelAction(page, "Launcher").click();
    const launcherOverlay = page.getByRole("dialog", {
      name: "Launcher overlay",
    });
    await expect(launcherOverlay).toBeVisible();
    await expect(page.locator('[data-window-kind="search"]')).toHaveCount(0);
    await expect(
      launcherOverlay.getByPlaceholder("Search workspace..."),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Launcher overlay" }),
    ).toHaveCount(0);

    await getContextPanelAction(page, "Launcher").click();
    const reopenedOverlay = page.getByRole("dialog", {
      name: "Launcher overlay",
    });
    await expect(reopenedOverlay).toBeVisible();
    await reopenedOverlay.getByRole("button", { name: "Note" }).click();
    await expect(
      page.getByRole("dialog", { name: "Launcher overlay" }),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("workspace-context-panel").first(),
    ).toBeVisible();
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
