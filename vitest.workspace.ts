import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageAlias = (name: string, entry = "index.ts") => ({
  [`@pi-desktop/${name}`]: fileURLToPath(
    new URL(`./packages/${name}/src/${entry}`, import.meta.url),
  ),
  [`@pi-desktop/${name}/*`]: fileURLToPath(
    new URL(`./packages/${name}/src`, import.meta.url),
  ),
});

export default defineConfig({
  test: {
    projects: [
      "./apps/desktop/vitest.config.ts",
      "./packages/ui/vitest.config.ts",
      {
        resolve: {
          alias: {
            ...packageAlias("contracts"),
            ...packageAlias("shared"),
            ...packageAlias("ui"),
            ...packageAlias("shell-model"),
            ...packageAlias("agent-host"),
          },
        },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.spec.ts"],
          exclude: ["tests/e2e/**/*.spec.ts"],
        },
      },
    ],
  },
});
