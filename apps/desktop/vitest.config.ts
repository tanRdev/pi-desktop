import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/renderer/src", import.meta.url)),
      "@pi-desktop/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
      "@pi-desktop/shared/*": fileURLToPath(
        new URL("../../packages/shared/src", import.meta.url),
      ),
      "@pi-desktop/ui": fileURLToPath(
        new URL("../../packages/ui/src/index.ts", import.meta.url),
      ),
      "@pi-desktop/ui/*": fileURLToPath(
        new URL("../../packages/ui/src", import.meta.url),
      ),
    },
  },
  test: {
    name: "desktop-components",
    environment: "jsdom",
    include: ["src/**/*.spec.tsx"],
    setupFiles: ["./src/test/vitest.setup.ts"],
    css: true,
  },
});
