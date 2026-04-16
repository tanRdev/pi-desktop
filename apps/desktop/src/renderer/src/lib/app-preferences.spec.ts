import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_AI_PREFERENCES,
  normalizeAiPreferences,
  readLegacySettings,
  readLegacySettingsStorage,
  STORAGE_KEY,
} from "./app-preferences";

describe("normalizeAiPreferences", () => {
  it("returns defaults for non-object input", () => {
    expect(normalizeAiPreferences(null)).toEqual(DEFAULT_AI_PREFERENCES);
    expect(normalizeAiPreferences(undefined)).toEqual(DEFAULT_AI_PREFERENCES);
    expect(normalizeAiPreferences("str")).toEqual(DEFAULT_AI_PREFERENCES);
  });

  it("extracts provider and model when present", () => {
    expect(
      normalizeAiPreferences({ provider: "anthropic", model: "claude-opus" }),
    ).toEqual({ provider: "anthropic", model: "claude-opus" });
  });

  it("falls back to defaults for missing/non-string fields", () => {
    expect(normalizeAiPreferences({ provider: 42, model: null })).toEqual(
      DEFAULT_AI_PREFERENCES,
    );
  });

  it("mixes provided and default values", () => {
    expect(normalizeAiPreferences({ provider: "openai" })).toEqual({
      provider: "openai",
      model: DEFAULT_AI_PREFERENCES.model,
    });
  });
});

describe("readLegacySettings", () => {
  it("returns null when no legacy fields are present", () => {
    expect(readLegacySettings(null)).toBeNull();
    expect(readLegacySettings({})).toBeNull();
    expect(readLegacySettings({ ai: {}, interface: {} })).toBeNull();
  });

  it("reads ai provider and model", () => {
    const result = readLegacySettings({
      ai: { provider: "openai", model: "gpt-4" },
    });

    expect(result).toEqual({
      ai: { provider: "openai", model: "gpt-4" },
      leftSidebarWidth: null,
    });
  });

  it("reads sidebar width from interface", () => {
    const result = readLegacySettings({
      interface: { sidebarWidth: 260 },
    });

    expect(result).toEqual({
      ai: DEFAULT_AI_PREFERENCES,
      leftSidebarWidth: 260,
    });
  });

  it("combines ai and interface fields", () => {
    const result = readLegacySettings({
      ai: { provider: "anthropic", model: "claude" },
      interface: { sidebarWidth: 300 },
    });

    expect(result).toEqual({
      ai: { provider: "anthropic", model: "claude" },
      leftSidebarWidth: 300,
    });
  });

  it("ignores non-number sidebarWidth", () => {
    expect(
      readLegacySettings({ interface: { sidebarWidth: "300" } }),
    ).toBeNull();
  });
});

describe("readLegacySettingsStorage", () => {
  let store: Record<string, string>;
  let originalLocalStorage: PropertyDescriptor | undefined;

  beforeEach(() => {
    store = {};
    originalLocalStorage = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) =>
          Object.hasOwn(store, key) ? store[key] : null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          store = {};
        },
        key: () => null,
        length: 0,
      },
    });
  });

  afterEach(() => {
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
    } else {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  });

  it("returns null when storage is empty", () => {
    expect(readLegacySettingsStorage()).toBeNull();
  });

  it("returns parsed legacy settings when present", () => {
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ai: { provider: "anthropic", model: "claude" },
        interface: { sidebarWidth: 240 },
      }),
    );

    expect(readLegacySettingsStorage()).toEqual({
      ai: { provider: "anthropic", model: "claude" },
      leftSidebarWidth: 240,
    });
  });

  it("returns null for invalid JSON", () => {
    globalThis.localStorage.setItem(STORAGE_KEY, "not-json");
    expect(readLegacySettingsStorage()).toBeNull();
  });

  it("returns null for empty legacy fields", () => {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify({}));
    expect(readLegacySettingsStorage()).toBeNull();
  });
});
