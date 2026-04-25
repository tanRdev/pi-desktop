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
      "@pi-desktop/agent-host": fileURLToPath(
        new URL("./src/index.ts", import.meta.url),
      ),
      "@pi-desktop/agent-host/*": fileURLToPath(
        new URL("./src", import.meta.url),
      ),
    },
  },
  test: {
    name: "agent-host",
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
