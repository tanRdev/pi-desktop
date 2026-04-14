import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "./apps/desktop/vitest.config.ts",
      {
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
