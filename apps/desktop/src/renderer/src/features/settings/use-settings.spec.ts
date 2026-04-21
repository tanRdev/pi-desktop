// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_UI_SETTINGS,
  normalizeUiSettings,
  UI_SETTINGS_STORAGE_KEY,
  useSettings,
} from "./use-settings";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("useSettings", () => {
  it("returns defaults when no storage entry exists", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual(DEFAULT_UI_SETTINGS);
  });

  it("persists updates to localStorage", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.update((prev) => ({ ...prev, fontSize: 16 }));
    });

    expect(result.current.settings.fontSize).toBe(16);
    const raw = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    if (raw !== null) {
      expect(JSON.parse(raw).fontSize).toBe(16);
    }
  });

  it("restores persisted state on remount", () => {
    window.localStorage.setItem(
      UI_SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_UI_SETTINGS, theme: "dark", fontSize: 18 }),
    );

    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.theme).toBe("dark");
    expect(result.current.settings.fontSize).toBe(18);
  });

  it("resets to defaults", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.update((prev) => ({ ...prev, fontSize: 20 }));
    });
    expect(result.current.settings.fontSize).toBe(20);

    act(() => {
      result.current.reset();
    });
    expect(result.current.settings).toEqual(DEFAULT_UI_SETTINGS);
  });
});

describe("normalizeUiSettings", () => {
  it("falls back to defaults for malformed input", () => {
    expect(normalizeUiSettings(null)).toEqual(DEFAULT_UI_SETTINGS);
    expect(normalizeUiSettings("broken")).toEqual(DEFAULT_UI_SETTINGS);
  });

  it("rejects unknown theme values", () => {
    const result = normalizeUiSettings({ theme: "neon" });
    expect(result.theme).toBe(DEFAULT_UI_SETTINGS.theme);
  });

  it("preserves valid nested values", () => {
    const result = normalizeUiSettings({
      theme: "light",
      editor: { tabSize: 4, wordWrap: false, lineNumbers: false },
      terminal: { cursorStyle: "bar" },
    });
    expect(result.theme).toBe("light");
    expect(result.editor.tabSize).toBe(4);
    expect(result.editor.wordWrap).toBe(false);
    expect(result.editor.lineNumbers).toBe(false);
    expect(result.terminal.cursorStyle).toBe("bar");
    // unsupplied numbers still defaulted
    expect(result.terminal.fontSize).toBe(
      DEFAULT_UI_SETTINGS.terminal.fontSize,
    );
  });
});
