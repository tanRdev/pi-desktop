import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  createThreadFromSidebar,
  focusChatThread,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

async function getModelState(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const shell = await window.piDesktop.shell.getSnapshot();
    const agent = await window.piDesktop.agent.getSnapshot();

    return {
      shellSelectionThreadId: shell.catalog.selection.threadId,
      settingsProviderId: agent.currentProviderId ?? null,
      settingsModelId: agent.currentModelId ?? null,
      agentProviderId: agent.currentProviderId ?? null,
      agentModelId: agent.currentModelId ?? null,
    };
  });
}

test("reproduces model selector behavior in cli mode", async () => {
  test.setTimeout(120_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-model-switch-cli-",
    {
      agentMode: "cli",
    },
  );

  try {
    await waitForAppReady(page);
    await createThreadFromSidebar(page);
    await focusChatThread(page);

    await expect(page.getByTestId("model-selector-trigger")).toBeVisible();

    const before = await getModelState(page);

    await page.getByTestId("model-selector-trigger").click();
    await expect(
      page.getByTestId("model-option-google-gemini-2.5-pro"),
    ).toBeVisible();

    const target =
      before.settingsModelId === "gemini-2.5-flash"
        ? "model-option-google-gemini-2.5-pro"
        : "model-option-google-gemini-2.5-flash";

    await page.getByTestId(target).click();

    await expect
      .poll(async () => (await getModelState(page)).settingsModelId, {
        timeout: 15_000,
      })
      .not.toBe(before.settingsModelId);

    const after = await getModelState(page);

    expect(after.shellSelectionThreadId).toBe(before.shellSelectionThreadId);
    expect(after.settingsModelId).not.toBe(before.settingsModelId);
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
  }
});
