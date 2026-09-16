import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import type { Plugin } from "vite";

const mainEntry = fileURLToPath(
  new URL("./src/main/index.ts", import.meta.url),
);

function rejectEmptyMainChunks(): Plugin {
  return {
    name: "reject-empty-main-chunks",
    generateBundle(_options, bundle) {
      const empty = Object.values(bundle).filter(
        (item) =>
          (item.type === "chunk" && item.code.trim().length === 0) ||
          (item.type === "asset" &&
            typeof item.fileName === "string" &&
            /\.(?:[cm]?js)$/.test(item.fileName) &&
            (typeof item.source === "string"
              ? item.source.trim().length === 0
              : Buffer.from(item.source).toString("utf8").trim().length === 0)),
      );
      if (empty.length === 0) {
        return;
      }
      const names = empty.map((item) => item.fileName).join(", ");
      throw new Error(
        `Main process build emitted empty JS chunk(s): ${names}. Shared empty chunks crash Electron on launch (missing named exports).`,
      );
    },
  };
}

const workspaceAliases = {
  "@pi-desktop/contracts": fileURLToPath(
    new URL("../../packages/contracts/src", import.meta.url),
  ),
  "@pi-desktop/shared": fileURLToPath(
    new URL("../../packages/shared/src", import.meta.url),
  ),
  "@pi-desktop/agent-host": fileURLToPath(
    new URL("../../packages/agent-host/src", import.meta.url),
  ),
};

export default defineConfig({
  main: {
    resolve: {
      alias: workspaceAliases,
    },
    build: {
      externalizeDeps: true,
      outDir: "out/main",
      rollupOptions: {
        external: ["electron", "node-pty"],
        input: {
          index: mainEntry,
        },
        treeshake: false,
        plugins: [rejectEmptyMainChunks()],
        output: {
          // Single main entry. The agent session server is bundled separately
          // via `?modulePath`. Two Rollup inputs here created the shared
          // empty chunk that crashed v0.9.3.
          inlineDynamicImports: true,
        },
      },
    },
  },
  preload: {
    resolve: {
      alias: workspaceAliases,
    },
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
