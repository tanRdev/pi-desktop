// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  applyUiSettingsToDocument,
  resolveMonoFontFamily,
  resolveSansFontFamily,
} from "./apply-ui-settings";
import { DEFAULT_UI_SETTINGS } from "./use-settings";

afterEach(() => {
  document.documentElement.removeAttribute("data-reduced-motion");
  document.documentElement.style.removeProperty("--app-font-sans");
  document.documentElement.style.fontSize = "";
  document.body.style.fontSize = "";
});

describe("applyUiSettingsToDocument", () => {
  it("maps Geist Variable to a CSS stack and sets font-size", () => {
    applyUiSettingsToDocument({
      ...DEFAULT_UI_SETTINGS,
      fontFamily: "Geist Variable",
      fontSize: 16,
    });

    expect(
      document.documentElement.style.getPropertyValue("--app-font-sans"),
    ).toBe('"Geist Variable", Geist, sans-serif');
    expect(document.documentElement.style.fontSize).toBe("16px");
    expect(document.documentElement.hasAttribute("data-reduced-motion")).toBe(
      false,
    );
  });

  it("sets data-reduced-motion when enabled", () => {
    applyUiSettingsToDocument({
      ...DEFAULT_UI_SETTINGS,
      reducedMotion: true,
    });
    expect(document.documentElement.getAttribute("data-reduced-motion")).toBe(
      "true",
    );
  });
});

describe("font family helpers", () => {
  it("resolves known mono faces", () => {
    expect(resolveMonoFontFamily("Geist Mono")).toContain(
      "Geist Mono Variable",
    );
    expect(resolveSansFontFamily("Geist Variable")).toContain("Geist");
  });
});
