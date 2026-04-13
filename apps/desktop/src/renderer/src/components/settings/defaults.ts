export interface AISettings {
  provider?: string;
  model?: string;
}

export interface InterfaceSettings {
  sidebarWidth: number;
}

export interface Settings {
  ai: AISettings;
  interface: InterfaceSettings;
  editor: Record<string, never>;
  terminal: Record<string, never>;
  keybindings: Record<string, never>;
  advanced: Record<string, never>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNumberField(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

function getStringField(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

export function mergeSettingsWithDefaults(value: unknown): Settings {
  const parsed = isRecord(value) ? value : {};
  const parsedAi = isRecord(parsed.ai) ? parsed.ai : {};
  const parsedInterface = isRecord(parsed.interface) ? parsed.interface : {};
  const provider = getStringField(parsedAi, "provider");
  const model = getStringField(parsedAi, "model");
  const sidebarWidth = getNumberField(parsedInterface, "sidebarWidth");

  return {
    ai: {
      ...(provider === null ? {} : { provider }),
      ...(model === null ? {} : { model }),
    },
    interface: {
      ...DEFAULT_SETTINGS.interface,
      ...(sidebarWidth === null ? {} : { sidebarWidth }),
    },
    editor: {},
    terminal: {},
    keybindings: {},
    advanced: {},
  };
}

export function readLegacySettingsStorage(): Settings | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  try {
    const stored = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    return mergeSettingsWithDefaults(JSON.parse(stored));
  } catch {
    return null;
  }
}

export const DEFAULT_SETTINGS: Settings = {
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
};

export const STORAGE_KEY = "pidesk-settings";
