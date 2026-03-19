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

test("opens launcher and note windows from the title bar", async () => {
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
    await expect(page.getByTestId("titlebar-project-name")).toHaveText(
      "PiDesk",
    );
    await expect(page.getByTestId("canvas-grid")).toBeVisible();
    await page.getByTestId("app-title").click();
    await expect(page.locator('[data-window-kind="search"]')).toBeVisible();
    await expect(page.getByPlaceholder("Search workspace...")).toBeVisible();

    await page.getByRole("button", { name: "Open notes" }).click();
    await expect(page.locator('[data-window-kind="note"]')).toBeVisible();
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
