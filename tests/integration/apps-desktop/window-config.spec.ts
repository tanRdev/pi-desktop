import { describe, expect, it } from "vitest";

import {
  createMainWindowOptions,
  resolvePreloadTarget,
  resolveRendererTarget,
  shouldShowMainWindow,
} from "../../../apps/desktop/src/main/window-config";
import { getTitleBarLeftPadding } from "../../../apps/desktop/src/renderer/src/lib/title-bar-layout";

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

  it("keeps the window hidden until the main process decides to show it", () => {
    const options = createMainWindowOptions({
      preloadPath: "/tmp/pidesk/preload.js",
    });

    expect(options.show).toBe(false);
  });
});

describe("shouldShowMainWindow", () => {
  it("shows the main window by default", () => {
    expect(shouldShowMainWindow({})).toBe(true);
  });

  it("suppresses the main window when headless mode is enabled", () => {
    expect(shouldShowMainWindow({ PIDESK_HEADLESS: "1" })).toBe(false);
  });

  it("preserves the normal app behavior for other values", () => {
    expect(shouldShowMainWindow({ PIDESK_HEADLESS: "0" })).toBe(true);
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

describe("getTitleBarLeftPadding", () => {
  it("uses traffic-light spacing on macOS when not fullscreen", () => {
    expect(
      getTitleBarLeftPadding({ isFullscreen: false, platform: "darwin" }),
    ).toBe(88);
  });

  it("shifts left when fullscreen hides traffic lights", () => {
    expect(
      getTitleBarLeftPadding({ isFullscreen: true, platform: "darwin" }),
    ).toBe(24);
  });

  it("keeps a smaller inset on non-macOS platforms", () => {
    expect(
      getTitleBarLeftPadding({ isFullscreen: false, platform: "linux" }),
    ).toBe(16);
  });
});
