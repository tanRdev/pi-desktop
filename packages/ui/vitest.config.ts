import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      "@pi-desktop/ui": fileURLToPath(
        new URL("./src/index.ts", import.meta.url),
      ),
      "@pi-desktop/ui/*": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    name: "ui-components",
    environment: "jsdom",
    include: ["src/**/*.spec.{ts,tsx}"],
    setupFiles: ["./src/test/vitest.setup.ts"],
    css: true,
  },
});
