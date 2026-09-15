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

  it("builds the main process as a single entry without shared chunks", () => {
    const output = config.main?.build?.rollupOptions?.output;
    const outputOptions = Array.isArray(output) ? output[0] : output;
    const plugins = config.main?.build?.rollupOptions?.plugins ?? [];
    const input = config.main?.build?.rollupOptions?.input;

    expect(outputOptions?.inlineDynamicImports).toBe(true);
    expect(outputOptions?.experimentalMinChunkSize).toBeUndefined();
    expect(input).toEqual({
      index: expect.any(String),
    });
    expect(input).not.toHaveProperty("agentHostSessionServer");
    expect(
      plugins.some((plugin) => plugin?.name === "reject-empty-main-chunks"),
    ).toBe(true);
  });
});
