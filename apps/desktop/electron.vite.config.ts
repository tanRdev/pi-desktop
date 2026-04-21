import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const mainEntry = fileURLToPath(
  new URL("./src/main/index.ts", import.meta.url),
);
const agentHostSessionServerEntry = fileURLToPath(
  new URL("./src/main/agent-host-session-server-entry.ts", import.meta.url),
);
export default defineConfig({
  main: {
    resolve: {
      alias: {
        "@pi-desktop/shared": fileURLToPath(
          new URL("../../packages/shared/src", import.meta.url),
        ),
        "@pi-desktop/agent-host": fileURLToPath(
          new URL("../../packages/agent-host/src", import.meta.url),
        ),
      },
    },
    build: {
      externalizeDeps: true,
      outDir: "out/main",
      rollupOptions: {
        external: ["electron", "node-pty"],
        input: {
          index: mainEntry,
          agentHostSessionServer: agentHostSessionServerEntry,
        },
        treeshake: false,
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: false,
      outDir: "out/preload",
      rollupOptions: {
        external: ["electron"],
        input: "src/preload/index.ts",
        output: {
          format: "cjs",
          inlineDynamicImports: true,
        },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src/renderer/src", import.meta.url)),
        "@pi-desktop/shared": fileURLToPath(
          new URL("../../packages/shared/src", import.meta.url),
        ),
        "@pi-desktop/ui": fileURLToPath(
          new URL("../../packages/ui/src", import.meta.url),
        ),
        "@pi-desktop/shell-model": fileURLToPath(
          new URL("../../packages/shell-model/src/index.ts", import.meta.url),
        ),
      },
    },
    build: {
      outDir: "out/renderer",
    },
    plugins: [react(), tailwindcss()],
  },
});
