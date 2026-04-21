import { useCallback, useEffect, useState } from "react";

/**
 * UI-local preferences — extended settings that are not yet part of the
 * shared AppPreferences schema. These are persisted to localStorage only.
 * When the backend adds support for any of these keys, swap the reader/writer
 * for that key to `window.piDesktop.state.updateAppPreferences`.
 */
export type ThemeChoice = "system" | "light" | "dark";
export type CursorStyle = "block" | "bar" | "underline";

export interface UiSettings {
  theme: ThemeChoice;
  fontFamily: string;
  fontSize: number;
  reducedMotion: boolean;
  editor: {
    tabSize: number;
    wordWrap: boolean;
    lineNumbers: boolean;
  };
  terminal: {
    fontFamily: string;
    fontSize: number;
    scrollback: number;
    cursorStyle: CursorStyle;
  };
  updates: {
    autoUpdate: boolean;
  };
}

export const DEFAULT_UI_SETTINGS: UiSettings = {
  theme: "system",
  fontFamily: "Inter Variable",
  fontSize: 13,
  reducedMotion: false,
  editor: {
    tabSize: 2,
    wordWrap: true,
    lineNumbers: true,
  },
  terminal: {
    fontFamily: "Source Code Pro",
    fontSize: 12,
    scrollback: 1000,
    cursorStyle: "block",
  },
  updates: {
    autoUpdate: true,
  },
};

export const UI_SETTINGS_STORAGE_KEY = "pi-desktop-ui-settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickString(
  source: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const v = source[key];
  return typeof v === "string" ? v : fallback;
}

function pickNumber(
  source: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = source[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function pickBool(
  source: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const v = source[key];
  return typeof v === "boolean" ? v : fallback;
}

function pickTheme(value: unknown): ThemeChoice {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return DEFAULT_UI_SETTINGS.theme;
}

function pickCursor(value: unknown): CursorStyle {
  if (value === "block" || value === "bar" || value === "underline") {
    return value;
  }
  return DEFAULT_UI_SETTINGS.terminal.cursorStyle;
}

export function normalizeUiSettings(input: unknown): UiSettings {
  const root = isRecord(input) ? input : {};
  const editor = isRecord(root.editor) ? root.editor : {};
  const terminal = isRecord(root.terminal) ? root.terminal : {};
  const updates = isRecord(root.updates) ? root.updates : {};

  return {
    theme: pickTheme(root.theme),
    fontFamily: pickString(root, "fontFamily", DEFAULT_UI_SETTINGS.fontFamily),
    fontSize: pickNumber(root, "fontSize", DEFAULT_UI_SETTINGS.fontSize),
    reducedMotion: pickBool(
      root,
      "reducedMotion",
      DEFAULT_UI_SETTINGS.reducedMotion,
    ),
    editor: {
      tabSize: pickNumber(
        editor,
        "tabSize",
        DEFAULT_UI_SETTINGS.editor.tabSize,
      ),
      wordWrap: pickBool(
        editor,
        "wordWrap",
        DEFAULT_UI_SETTINGS.editor.wordWrap,
      ),
      lineNumbers: pickBool(
        editor,
        "lineNumbers",
        DEFAULT_UI_SETTINGS.editor.lineNumbers,
      ),
    },
    terminal: {
      fontFamily: pickString(
        terminal,
        "fontFamily",
        DEFAULT_UI_SETTINGS.terminal.fontFamily,
      ),
      fontSize: pickNumber(
        terminal,
        "fontSize",
        DEFAULT_UI_SETTINGS.terminal.fontSize,
      ),
      scrollback: pickNumber(
        terminal,
        "scrollback",
        DEFAULT_UI_SETTINGS.terminal.scrollback,
      ),
      cursorStyle: pickCursor(terminal.cursorStyle),
    },
    updates: {
      autoUpdate: pickBool(
        updates,
        "autoUpdate",
        DEFAULT_UI_SETTINGS.updates.autoUpdate,
      ),
    },
  };
}

function readStorage(): UiSettings {
  if (typeof globalThis.localStorage === "undefined") {
    return DEFAULT_UI_SETTINGS;
  }
  try {
    const raw = globalThis.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_UI_SETTINGS;
    return normalizeUiSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_UI_SETTINGS;
  }
}

function writeStorage(value: UiSettings): void {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    globalThis.localStorage.setItem(
      UI_SETTINGS_STORAGE_KEY,
      JSON.stringify(value),
    );
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export type SettingsUpdater = (prev: UiSettings) => UiSettings;

export interface UseSettingsResult {
  settings: UiSettings;
  update: (updater: SettingsUpdater) => void;
  reset: () => void;
}

/**
 * Reads UI settings from localStorage with optimistic updates. A future
 * version can pipe these through `window.piDesktop.state.updateAppPreferences`
 * once the shared `AppPreferences` model grows matching fields.
 */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<UiSettings>(() => readStorage());

  useEffect(() => {
    writeStorage(settings);
  }, [settings]);

  const update = useCallback((updater: SettingsUpdater) => {
    setSettings((prev) => updater(prev));
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_UI_SETTINGS);
  }, []);

  return { settings, update, reset };
}
