import { expect, test } from "@playwright/test";
import {
  getContextPanelAction,
  getWorkspacePrimarySurface,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

test("opens launcher and file overlays, then routes terminal and file actions into sidecar surfaces", async () => {
  test.setTimeout(45_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-launcher-",
  );

  try {
    await waitForAppReady(page);

    await getContextPanelAction(page, "Launcher").click();

    const launcherOverlay = page.getByRole("dialog", {
      name: "Launcher overlay",
    });
    await expect(launcherOverlay).toBeVisible();
    await expect(
      launcherOverlay.getByPlaceholder("Search workspace..."),
    ).toBeVisible();
    await expect(
      launcherOverlay.getByRole("button", { name: "Terminal" }),
    ).toBeVisible();
    await expect(
      launcherOverlay.getByRole("button", { name: "Git" }),
    ).toBeVisible();
    await expect(
      launcherOverlay.getByRole("button", { name: "Terminal" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(launcherOverlay).toHaveCount(0);

    await getContextPanelAction(page, "Launcher").click();
    await launcherOverlay.getByRole("button", { name: "Terminal" }).click();

    await expect(launcherOverlay).toHaveCount(0);
    const contextPanel = getWorkspacePrimarySurface(page);
    await expect(contextPanel).toBeVisible();

    await getContextPanelAction(page, "Files").click();

    const fileTreeOverlay = page.getByRole("dialog", {
      name: "File tree overlay",
    });
    await expect(fileTreeOverlay).toBeVisible();
    await fileTreeOverlay.getByRole("button", { name: "PACKAGE.JSON" }).click();

    await expect(fileTreeOverlay).toHaveCount(0);
    await expect(contextPanel).toBeVisible();
    await expect(contextPanel).toContainText("package.json");
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
