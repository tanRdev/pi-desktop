import { describe, expect, it } from "vitest";

import config from "../../../apps/desktop/electron.vite.config";

describe("electron-vite config", () => {
  it("keeps Electron external while making preload sandbox-compatible", () => {
    expect(config.main?.build?.externalizeDeps).toBe(true);
    expect(config.preload?.build?.externalizeDeps).toBe(false);
    expect(config.main?.build?.rollupOptions?.external).toContain("electron");
    expect(config.preload?.build?.rollupOptions?.external).toContain(
      "electron",
    );

    const preloadOutput = config.preload?.build?.rollupOptions?.output;

    expect(
      Array.isArray(preloadOutput)
        ? preloadOutput[0]?.format
        : preloadOutput?.format,
    ).toBe("cjs");
    expect(config.renderer?.build?.outDir).toBe("out/renderer");
  });
});
