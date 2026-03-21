import { expect, test } from "@playwright/test";
import { launchDesktopApp, waitForAppReady } from "./helpers/desktop-app";

test("opens launcher and file overlays, then routes note and file actions into canvas windows", async () => {
  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-launcher-",
  );

  try {
    await waitForAppReady(page);

    await page.getByRole("button", { name: "Open launcher" }).click();

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
      launcherOverlay.getByRole("button", { name: "Note" }),
    ).toBeVisible();
    await expect(
      launcherOverlay.getByRole("button", { name: "Graph" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(launcherOverlay).toHaveCount(0);

    await page.getByRole("button", { name: "Open launcher" }).click();
    await launcherOverlay.getByRole("button", { name: "Note" }).click();

    await expect(launcherOverlay).toHaveCount(0);
    const noteWindow = page.locator('[data-window-kind="note"]').first();
    await expect(noteWindow).toBeVisible();
    await expect(noteWindow.getByTestId("window-title")).toContainText("Note");

    await page.getByRole("button", { name: "Open file tree" }).click();

    const fileTreeOverlay = page.getByRole("dialog", {
      name: "File tree overlay",
    });
    await expect(fileTreeOverlay).toBeVisible();
    await fileTreeOverlay.getByRole("button", { name: "PACKAGE.JSON" }).click();

    await expect(fileTreeOverlay).toHaveCount(0);
    const fileWindow = page.locator('[data-window-kind="file"]').first();
    await expect(fileWindow).toBeVisible();
    await expect(fileWindow.getByTestId("window-title")).toHaveText(
      "package.json",
    );
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
