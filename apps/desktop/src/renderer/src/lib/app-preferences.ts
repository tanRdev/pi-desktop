export interface LegacySettings {
  ai: {
    provider: string;
    model: string;
  };
  leftSidebarWidth: number | null;
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

export function normalizeAiPreferences(value: unknown): {
  provider: string;
  model: string;
} {
  const parsed = isRecord(value) ? value : {};
  const provider = getStringField(parsed, "provider");
  const model = getStringField(parsed, "model");

  return {
    provider: provider ?? DEFAULT_AI_PREFERENCES.provider,
    model: model ?? DEFAULT_AI_PREFERENCES.model,
  };
}

export function readLegacySettings(value: unknown): LegacySettings | null {
  const parsed = isRecord(value) ? value : {};
  const parsedAi = isRecord(parsed.ai) ? parsed.ai : {};
  const parsedInterface = isRecord(parsed.interface) ? parsed.interface : {};
  const provider = getStringField(parsedAi, "provider");
  const model = getStringField(parsedAi, "model");
  const sidebarWidth = getNumberField(parsedInterface, "sidebarWidth");

  if (provider === null && model === null && sidebarWidth === null) {
    return null;
  }

  return {
    ai: {
      provider: provider ?? DEFAULT_AI_PREFERENCES.provider,
      model: model ?? DEFAULT_AI_PREFERENCES.model,
    },
    leftSidebarWidth: sidebarWidth,
  };
}

export function readLegacySettingsStorage(): LegacySettings | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  try {
    const stored = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    return readLegacySettings(JSON.parse(stored));
  } catch {
    return null;
  }
}

export const DEFAULT_AI_PREFERENCES = {
  provider: "",
  model: "",
};

export const STORAGE_KEY = "pidesk-settings";
