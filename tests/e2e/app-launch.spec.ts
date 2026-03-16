import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const desktopMainEntry = path.join(repoRoot, "apps/desktop/out/main/index.js");

test("launches the shell and streams a mock agent reply", async () => {
  const app = await electron.launch({
    args: [desktopMainEntry],
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PIDESK_AGENT_MODE: "mock",
    },
  });

  try {
    const page = await app.firstWindow();

    await expect(page.getByTestId("app-ready")).toBeVisible();
    await expect(page.getByTestId("app-title")).toHaveText("π");
    await expect(page.getByTestId("agent-status")).toHaveText("ready");

    await page
      .getByTestId("chat-input")
      .fill("Summarize the current workspace");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("agent-status")).toHaveText("ready");
    await expect(page.getByTestId("chat-transcript")).toContainText(
      "PiDesk mock assistant received: Summarize the current workspace",
    );
  } finally {
    await app.close();
  }
});
