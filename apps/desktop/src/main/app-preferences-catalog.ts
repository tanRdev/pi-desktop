import path from "node:path";
import type { AppPreferences } from "@pidesk/shared";
import { PersistentJsonFile } from "./persistent-json-file";

type AppPreferencesDocument = {
  version: 1;
  preferences: AppPreferences;
};

const DEFAULT_DOCUMENT: AppPreferencesDocument = {
  version: 1,
  preferences: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mergeAiPreferences(
  current: AppPreferences["ai"],
  updates: AppPreferences["ai"],
): AppPreferences["ai"] | undefined {
  if (updates === undefined) {
    return current;
  }

  if (updates === null) {
    return null;
  }

  const currentRecord = isRecord(current) ? current : {};
  const updateRecord = isRecord(updates) ? updates : {};
  const provider =
    typeof updateRecord.provider === "string"
      ? updateRecord.provider
      : typeof currentRecord.provider === "string"
        ? currentRecord.provider
        : undefined;
  const model =
    typeof updateRecord.model === "string"
      ? updateRecord.model
      : typeof currentRecord.model === "string"
        ? currentRecord.model
        : undefined;

  return {
    ...(provider === undefined ? {} : { provider }),
    ...(model === undefined ? {} : { model }),
  };
}

function mergeAppPreferences(
  current: AppPreferences,
  updates: Partial<AppPreferences>,
): AppPreferences {
  const nextAi = mergeAiPreferences(current.ai, updates.ai);
  const leftSidebarWidth =
    updates.leftSidebarWidth === undefined
      ? current.leftSidebarWidth
      : updates.leftSidebarWidth;

  return {
    ...(leftSidebarWidth === undefined ? {} : { leftSidebarWidth }),
    ...(nextAi === undefined ? {} : { ai: nextAi }),
  };
}

export class AppPreferencesCatalog {
  private readonly store: PersistentJsonFile<AppPreferencesDocument>;

  constructor(userDataPath: string) {
    this.store = new PersistentJsonFile({
      filePath: path.join(userDataPath, "catalog", "app-preferences.json"),
      defaultValue: DEFAULT_DOCUMENT,
    });
  }

  get(): AppPreferences {
    return this.store.get().preferences;
  }

  update(updates: Partial<AppPreferences>): AppPreferences {
    return this.store.update((state) => ({
      ...state,
      preferences: mergeAppPreferences(state.preferences, updates),
    })).preferences;
  }
}
