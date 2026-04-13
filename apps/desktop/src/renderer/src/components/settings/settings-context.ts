import {
  DEFAULT_SETTINGS,
  mergeSettingsWithDefaults,
  type Settings,
} from "./defaults";

export interface SettingsDraftState {
  baseSignature: string;
  value: Settings;
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify(mergeSettingsWithDefaults(settings));
}

export function reconcileSettingsDraftState(
  localDraft: SettingsDraftState | null,
  persistedSignature: string,
  acknowledgedAutosaveSignatures: string[],
): SettingsDraftState | null {
  if (localDraft === null) {
    return null;
  }

  const localSignature = serializeSettings(localDraft.value);
  if (localSignature === persistedSignature) {
    return null;
  }

  if (acknowledgedAutosaveSignatures.includes(persistedSignature)) {
    return {
      baseSignature: persistedSignature,
      value: mergeSettingsWithDefaults(localDraft.value),
    };
  }

  if (localDraft.baseSignature === serializeSettings(DEFAULT_SETTINGS)) {
    return null;
  }

  return null;
}
