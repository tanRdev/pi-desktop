import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { launchDesktopApp, waitForAppReady } from "./helpers/desktop-app";

function readPersistedSidebarWidth(userDataDir: string): number | null {
  const preferencesPath = path.join(
    userDataDir,
    "catalog",
    "app-preferences.json",
  );

  if (!fs.existsSync(preferencesPath)) {
    return null;
  }

  const raw = JSON.parse(fs.readFileSync(preferencesPath, "utf8")) as {
    preferences?: {
      leftSidebarWidth?: number;
      settings?: {
        interface?: {
          sidebarWidth?: number;
        };
      };
    };
  };

  return (
    raw.preferences?.leftSidebarWidth ??
    raw.preferences?.settings?.interface?.sidebarWidth ??
    null
  );
}

test("renders AI settings controls and persists interface settings across relaunch", async () => {
  const firstLaunch = await launchDesktopApp("pidesk-e2e-settings-");

  try {
    await waitForAppReady(firstLaunch.page);

    await firstLaunch.page
      .getByRole("button", { name: "Open settings" })
      .click();

    const settingsModal = firstLaunch.page.getByTestId("settings-modal");
    await expect(settingsModal).toBeVisible();

    await expect(
      firstLaunch.page.getByTestId("settings-provider-select"),
    ).toContainText("Google");
    await expect(
      firstLaunch.page.getByTestId("settings-model-select"),
    ).toContainText("Gemini 2.5 Pro");

    await firstLaunch.page.getByTestId("settings-nav-interface").click();

    const sidebarSlider = firstLaunch.page.getByTestId(
      "settings-sidebar-width-slider",
    );
    await sidebarSlider.evaluate((element) => {
      const input = element as HTMLInputElement;
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      );

      descriptor?.set?.call(input, "320");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(sidebarSlider).toHaveValue("320");

    await expect
      .poll(
        () => readPersistedSidebarWidth(firstLaunch.launchContext.userDataDir),
        {
          timeout: 10_000,
        },
      )
      .toBe(320);

    await firstLaunch.page.getByRole("button", { name: "Done" }).click();
    await expect(settingsModal).toHaveCount(0);

    await firstLaunch.app.close();

    const relaunched = await launchDesktopApp("pidesk-e2e-settings-relaunch-", {
      homeDir: firstLaunch.launchContext.homeDir,
      userDataDir: firstLaunch.launchContext.userDataDir,
    });

    try {
      await waitForAppReady(relaunched.page);
      await relaunched.page
        .getByRole("button", { name: "Open settings" })
        .click();
      await expect(relaunched.page.getByTestId("settings-modal")).toBeVisible();
      await relaunched.page.getByTestId("settings-nav-interface").click();
      await expect(
        relaunched.page.getByTestId("settings-sidebar-width-slider"),
      ).toHaveValue("320");
    } finally {
      await relaunched.app.close();
    }
  } finally {
    firstLaunch.launchContext.cleanup();
  }
});
