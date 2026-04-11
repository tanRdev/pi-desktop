import { describe, expect, it } from "vitest";

import {
  createMainWindowOptions,
  shouldAllowNavigation,
  shouldDenyWindowOpen,
  resolvePreloadTarget,
  resolveRendererTarget,
  shouldShowMainWindow,
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
    expect(options.paintWhenInitiallyHidden).toBe(false);
    expect(options.titleBarStyle).toBe("hiddenInset");
    expect(options.webPreferences).toMatchObject({
      preload: "/tmp/pidesk/preload.js",
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
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
      value: "http://127.0.0.1:5173/",
    });
  });

  it("rejects non-local renderer dev server URLs", () => {
    expect(() =>
      resolveRendererTarget(
        "https://example.com",
        "file:///app/out/main/index.js",
      ),
    ).toThrow(/local http dev server/);
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

describe("window navigation hardening", () => {
  it("allows file navigation targets", () => {
    expect(shouldAllowNavigation("file:///tmp/pidesk/index.html")).toBe(true);
  });

  it("blocks remote navigation targets", () => {
    expect(shouldAllowNavigation("https://example.com")).toBe(false);
  });

  it("denies remote popup requests", () => {
    expect(shouldDenyWindowOpen({ url: "https://example.com" } as never)).toBe(
      true,
    );
  });
});
