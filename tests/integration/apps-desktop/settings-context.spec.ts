import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  mergeSettingsWithDefaults,
} from "../../../apps/desktop/src/renderer/src/components/settings/defaults";
import {
  reconcileSettingsDraftState,
  serializeSettings,
} from "../../../apps/desktop/src/renderer/src/components/settings/settings-context";
import type { Settings } from "../../../apps/desktop/src/renderer/src/components/settings/types";

type SettingsOverrides = {
  [K in keyof Settings]?: Partial<Settings[K]>;
};

function buildSettings(overrides: SettingsOverrides = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
    ai: { ...DEFAULT_SETTINGS.ai, ...overrides.ai },
    interface: { ...DEFAULT_SETTINGS.interface, ...overrides.interface },
    editor: { ...DEFAULT_SETTINGS.editor, ...overrides.editor },
    terminal: { ...DEFAULT_SETTINGS.terminal, ...overrides.terminal },
    keybindings: {
      ...DEFAULT_SETTINGS.keybindings,
      ...overrides.keybindings,
    },
    advanced: { ...DEFAULT_SETTINGS.advanced, ...overrides.advanced },
  };
}

describe("settings-context draft reconciliation", () => {
  it("keeps only sidebar width in persisted settings defaults", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      ai: {
        provider: "",
        model: "",
      },
      interface: {
        sidebarWidth: 280,
      },
      editor: {},
      terminal: {},
      keybindings: {},
      advanced: {},
    });
  });

  it("drops legacy dead settings fields when merging persisted preferences", () => {
    expect(
      mergeSettingsWithDefaults({
        ai: {
          apiKey: "secret",
          provider: "openai",
          model: "gpt-4o",
        },
        interface: {
          sidebarWidth: 320,
          theme: "dark",
          accentColor: "green",
        },
        editor: {
          fontSize: 18,
        },
      }),
    ).toEqual({
      ai: {
        provider: "openai",
        model: "gpt-4o",
      },
      interface: {
        sidebarWidth: 320,
      },
      editor: {},
      terminal: {},
      keybindings: {},
      advanced: {},
    });
  });

  it("clears the local draft when persisted settings catch up exactly", () => {
    const persisted = buildSettings({
      interface: { sidebarWidth: 320 },
    });

    const reconciled = reconcileSettingsDraftState(
      {
        baseSignature: serializeSettings(DEFAULT_SETTINGS),
        value: persisted,
      },
      serializeSettings(persisted),
      [],
    );

    expect(reconciled).toBeNull();
  });

  it("rebases a newer local draft onto an acknowledged autosave", () => {
    const autosavedSettings = buildSettings({
      interface: { sidebarWidth: 320 },
    });
    const newerDraft = buildSettings({
      interface: { sidebarWidth: 360 },
    });
    const autosavedSignature = serializeSettings(autosavedSettings);

    const reconciled = reconcileSettingsDraftState(
      {
        baseSignature: serializeSettings(DEFAULT_SETTINGS),
        value: newerDraft,
      },
      autosavedSignature,
      [autosavedSignature],
    );

    expect(reconciled).toEqual({
      baseSignature: autosavedSignature,
      value: newerDraft,
    });
  });

  it("drops the local draft when preferences change from another source", () => {
    const externalPersistedSettings = buildSettings({
      interface: { sidebarWidth: 240 },
    });

    const reconciled = reconcileSettingsDraftState(
      {
        baseSignature: serializeSettings(DEFAULT_SETTINGS),
        value: buildSettings({
          interface: { sidebarWidth: 320 },
        }),
      },
      serializeSettings(externalPersistedSettings),
      [],
    );

    expect(reconciled).toBeNull();
  });
});
