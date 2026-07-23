import { defineConfig } from "@playwright/test";

/**
 * Electron smoke only — Spine 7. Run after `bun run --filter @pi-desktop/desktop build`
 * with `PI_DESKTOP_AGENT_MODE=mock`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    trace: "off",
  },
});
