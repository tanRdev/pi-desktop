import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: {
      "@pi-desktop/shared": fileURLToPath(
        new URL("../shared/src/index.ts", import.meta.url),
      ),
      "@pi-desktop/shared/*": fileURLToPath(
        new URL("../shared/src", import.meta.url),
      ),
    },
  },
  test: {
    name: "shell-model",
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
