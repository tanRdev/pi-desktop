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

test("launches the shell and streams a mock agent reply", async () => {
  const launchContext = createLaunchContext("pidesk-e2e-launch-");
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
    await expect(page.getByTestId("app-title")).toHaveText("π");
    await expect(page.getByTestId("titlebar-project-name")).toHaveText(
      "PiDesk",
    );
    await expect(page.getByTestId("canvas-grid")).toBeVisible();
    await expect(page.getByTestId("agent-status")).toHaveText("ready", {
      timeout: 10_000,
    });

    await page
      .getByTestId("chat-input")
      .fill("Summarize the current workspace");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("agent-status")).toHaveText("ready", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("chat-transcript")).toContainText(
      "PiDesk mock assistant received: Summarize the current workspace",
    );
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
