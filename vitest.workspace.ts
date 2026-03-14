import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    exclude: ["tests/e2e/**/*.spec.ts"],
    include: ["tests/integration/**/*.spec.ts"],
  },
});
