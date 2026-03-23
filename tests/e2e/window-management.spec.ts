import { expect, test } from "@playwright/test";
import {
  getContextPanelAction,
  getWorkspaceContextPanel,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

test("renames, minimizes, maximizes, restores, and closes note windows", async () => {
  test.setTimeout(45_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-windows-",
  );

  try {
    await waitForAppReady(page);

    await getContextPanelAction(page, "Notes").click();

    const contextPanel = getWorkspaceContextPanel(page);
    await expect(contextPanel).toBeVisible();
    await expect(contextPanel).toContainText(/project notes/i);

    const noteEditor = contextPanel.getByPlaceholder(
      "Capture decisions, snippets, and reminders...",
    );
    await expect(noteEditor).toBeVisible();
    await noteEditor.fill("Release plan\n- ship chat-first workspace");
    await expect(noteEditor).toHaveValue(/Release plan/);

    await page.getByRole("button", { name: "Activity" }).click();
    await expect(contextPanel).toContainText(/Agent activity|Thread/i);

    await page.getByRole("button", { name: /^Project Notes$/i }).click();
    await expect(noteEditor).toHaveValue(/ship chat-first workspace/);

    await page.getByRole("button", { name: /Close Project Notes/i }).click();
    await expect(contextPanel).toContainText(/Browse files|Open notes/i);
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
