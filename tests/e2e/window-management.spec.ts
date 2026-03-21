import { expect, test } from "@playwright/test";
import { launchDesktopApp, waitForAppReady } from "./helpers/desktop-app";

test("renames, minimizes, maximizes, restores, and closes note windows", async () => {
  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-windows-",
  );

  try {
    await waitForAppReady(page);

    await page.getByRole("button", { name: "Open notes" }).click();

    const noteWindow = page.locator('[data-window-kind="note"]').first();
    await expect(noteWindow).toBeVisible();
    await expect(noteWindow).toHaveAttribute("data-window-state", "normal");

    const title = noteWindow.getByTestId("window-title");
    await title.dblclick();
    const titleInput = noteWindow.getByTestId("window-title-input");
    await expect(titleInput).toBeVisible();
    await titleInput.fill("Release plan");
    await titleInput.press("Enter");
    await expect(title).toHaveText("Release plan");

    await noteWindow.locator('[data-control="minimize"]').click();
    await expect(noteWindow).toHaveAttribute("data-window-state", "minimized");

    await noteWindow.locator('[data-control="maximize"]').click();
    await expect(noteWindow).toHaveAttribute("data-window-state", "maximized");

    await noteWindow.locator('[data-control="maximize"]').click();
    await expect(noteWindow).toHaveAttribute("data-window-state", "normal");

    await noteWindow.locator('[data-control="close"]').click();
    await expect(noteWindow).toHaveCount(0);
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
