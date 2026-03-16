import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const desktopMainEntry = path.join(repoRoot, "apps/desktop/out/main/index.js");

test("opens launcher and note windows from the title bar", async () => {
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
    await page.getByTestId("app-title").click();
    await expect(page.locator('[data-window-kind="search"]')).toBeVisible();
    await expect(page.getByPlaceholder("Search workspace...")).toBeVisible();

    await page.getByRole("button", { name: "Notes" }).click();
    await expect(page.locator('[data-window-kind="note"]')).toBeVisible();
  } finally {
    await app.close();
  }
});
