import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const desktopMainEntry = path.join(repoRoot, "apps/desktop/out/main/index.js");

function createLaunchContext(prefix: string) {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const userDataDir = path.join(homeDir, ".pidesk-test-user-data");
  fs.mkdirSync(userDataDir, { recursive: true });

  return {
    homeDir,
    userDataDir,
    cleanup() {
      fs.rmSync(homeDir, { recursive: true, force: true });
    },
  };
}

test("opens launcher as an overlay and dismisses it on close or selection", async () => {
  const launchContext = createLaunchContext("pidesk-e2e-canvas-");
  const app = await electron.launch({
    args: [desktopMainEntry],
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: launchContext.homeDir,
      NODE_ENV: "test",
      PIDESK_AGENT_MODE: "mock",
      PIDESK_HEADLESS: "1",
      PIDESK_USER_DATA_DIR: launchContext.userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();

    await expect(page.getByTestId("app-ready")).toBeVisible();
    await expect(page.getByTestId("chat-first-layout")).toBeVisible();
    await page.getByRole("button", { name: "Open launcher" }).click();
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

    await page.getByRole("button", { name: "Open launcher" }).click();
    const reopenedOverlay = page.getByRole("dialog", {
      name: "Launcher overlay",
    });
    await expect(reopenedOverlay).toBeVisible();
    await reopenedOverlay.getByRole("button", { name: "Note" }).click();
    await expect(
      page.getByRole("dialog", { name: "Launcher overlay" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("workspace-context-panel")).toBeVisible();
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
