import type { HandlerDetails } from "electron";
import { describe, expect, it } from "vitest";
import {
  createMainWindowOptions,
  resolvePreloadTarget,
  resolveRendererTarget,
  shouldAllowNavigation,
  shouldDeferWindowShowUntilReady,
  shouldDenyWindowOpen,
  shouldOpenDevTools,
  shouldQuitWhenAllWindowsClosed,
  shouldShowMainWindow,
} from "../../../apps/desktop/src/main/window-config";

function createWindowOpenDetails(url: string): HandlerDetails {
  return {
    url,
    frameName: "",
    features: "",
    disposition: "foreground-tab",
    referrer: {
      url: "",
      policy: "no-referrer",
    },
    postBody: undefined,
  };
}

describe("createMainWindowOptions", () => {
  it("locks down the BrowserWindow web preferences", () => {
    const options = createMainWindowOptions({
      preloadPath: "/tmp/pi-desktop/preload.js",
    });

    expect(options.title).toBe("Pi Desktop");
    expect(options.show).toBe(false);
    expect(options.minWidth).toBe(1180);
    expect(options.minHeight).toBe(720);
    expect(options.backgroundColor).toBe("#0a0a0a");
    expect(options.paintWhenInitiallyHidden).toBe(false);
    expect(options.titleBarStyle).toBe("hiddenInset");
    expect(options.webPreferences).toMatchObject({
      preload: "/tmp/pi-desktop/preload.js",
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
      preloadPath: "/tmp/pi-desktop/preload.js",
    });

    expect(options.show).toBe(false);
  });
});

describe("shouldShowMainWindow", () => {
  it("shows the main window by default", () => {
    expect(shouldShowMainWindow({})).toBe(true);
  });

  it("suppresses the main window when headless mode is enabled", () => {
    expect(shouldShowMainWindow({ PI_DESKTOP_HEADLESS: "1" })).toBe(false);
  });

  it("preserves the normal app behavior for other values", () => {
    expect(shouldShowMainWindow({ PI_DESKTOP_HEADLESS: "0" })).toBe(true);
  });
});

describe("shouldQuitWhenAllWindowsClosed", () => {
  it("quits when non-macOS platforms lose their last window", () => {
    expect(shouldQuitWhenAllWindowsClosed({}, "linux")).toBe(true);
  });

  it("keeps the normal macOS behavior outside headless mode", () => {
    expect(shouldQuitWhenAllWindowsClosed({}, "darwin")).toBe(false);
  });

  it("quits headless macOS runs so tests do not hang on child processes", () => {
    expect(
      shouldQuitWhenAllWindowsClosed({ PI_DESKTOP_HEADLESS: "1" }, "darwin"),
    ).toBe(true);
  });
});

describe("shouldOpenDevTools", () => {
  it("opens DevTools only for unpackaged interactive development", () => {
    expect(shouldOpenDevTools({ NODE_ENV: "development" }, false)).toBe(true);
  });

  it("keeps DevTools closed for tests, packaged apps, and headless runs", () => {
    expect(shouldOpenDevTools({ NODE_ENV: "test" }, false)).toBe(false);
    expect(shouldOpenDevTools({ PI_DESKTOP_HEADLESS: "1" }, false)).toBe(false);
    expect(shouldOpenDevTools({ NODE_ENV: "development" }, true)).toBe(false);
  });
});

describe("shouldDeferWindowShowUntilReady", () => {
  it("does not wait for ready-to-show when hidden windows do not paint", () => {
    expect(
      shouldDeferWindowShowUntilReady({
        show: false,
        paintWhenInitiallyHidden: false,
      }),
    ).toBe(false);
  });

  it("allows ready-to-show gating when the hidden window can paint", () => {
    expect(
      shouldDeferWindowShowUntilReady({
        show: false,
        paintWhenInitiallyHidden: true,
      }),
    ).toBe(true);
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
        "file:///Applications/Pi Desktop.app/Contents/Resources/app/out/main/index.js",
      ),
    ).toEqual({
      kind: "file",
      value:
        "/Applications/Pi Desktop.app/Contents/Resources/app/out/renderer/index.html",
    });
  });
});

describe("resolvePreloadTarget", () => {
  it("resolves to the preload output relative to main entry", () => {
    expect(
      resolvePreloadTarget(
        "file:///Applications/Pi Desktop.app/Contents/Resources/app/out/main/index.js",
      ),
    ).toBe(
      "/Applications/Pi Desktop.app/Contents/Resources/app/out/preload/index.cjs",
    );
  });
});

describe("window navigation hardening", () => {
  it("allows file navigation targets", () => {
    expect(shouldAllowNavigation("file:///tmp/pi-desktop/index.html")).toBe(true);
  });

  it("blocks remote navigation targets", () => {
    expect(shouldAllowNavigation("https://example.com")).toBe(false);
  });

  it("denies remote popup requests", () => {
    expect(
      shouldDenyWindowOpen(createWindowOpenDetails("https://example.com")),
    ).toBe(true);
  });
});
