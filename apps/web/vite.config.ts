import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": "/src",
      "@pidesk/ui": fileURLToPath(
        new URL("../../packages/ui/src", import.meta.url),
      ),
      "@pidesk/shell-model": fileURLToPath(
        new URL("../../packages/shell-model/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 3000,
  },
});
