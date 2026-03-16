import { describe, expect, it } from "vitest";

import {
  createMainWindowOptions,
  resolvePreloadTarget,
  resolveRendererTarget,
} from "../../../apps/desktop/src/main/window-config";

describe("createMainWindowOptions", () => {
  it("locks down the BrowserWindow web preferences", () => {
    const options = createMainWindowOptions({
      preloadPath: "/tmp/pidesk/preload.js",
    });

    expect(options.title).toBe("PiDesk");
    expect(options.show).toBe(false);
    expect(options.minWidth).toBe(1180);
    expect(options.minHeight).toBe(720);
    expect(options.backgroundColor).toBe("#0a0a0a");
    expect(options.titleBarStyle).toBe("hiddenInset");
    expect(options.webPreferences).toMatchObject({
      preload: "/tmp/pidesk/preload.js",
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      webSecurity: true,
    });
  });
});

describe("resolveRendererTarget", () => {
  it("uses the dev server URL when one is provided", () => {
    expect(
      resolveRendererTarget(
        "http://127.0.0.1:5173",
        "file:///app/out/main/index.js",
      ),
    ).toEqual({
      kind: "url",
      value: "http://127.0.0.1:5173",
    });
  });

  it("falls back to the packaged renderer html file", () => {
    expect(
      resolveRendererTarget(
        undefined,
        "file:///Applications/PiDesk.app/Contents/Resources/app/out/main/index.js",
      ),
    ).toEqual({
      kind: "file",
      value:
        "/Applications/PiDesk.app/Contents/Resources/app/out/renderer/index.html",
    });
  });
});

describe("resolvePreloadTarget", () => {
  it("resolves to the preload output relative to main entry", () => {
    expect(
      resolvePreloadTarget(
        "file:///Applications/PiDesk.app/Contents/Resources/app/out/main/index.js",
      ),
    ).toBe(
      "/Applications/PiDesk.app/Contents/Resources/app/out/preload/index.cjs",
    );
  });
});
