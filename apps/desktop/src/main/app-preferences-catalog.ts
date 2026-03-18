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

function mergeAppPreferences(
  current: AppPreferences,
  updates: Partial<AppPreferences>,
): AppPreferences {
  const nextSettings =
    updates.settings === undefined
      ? current.settings
      : updates.settings === null
        ? null
        : {
            ...(current.settings && typeof current.settings === "object"
              ? current.settings
              : {}),
            ...updates.settings,
          };

  return {
    ...current,
    ...updates,
    ...(nextSettings === undefined ? {} : { settings: nextSettings }),
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
