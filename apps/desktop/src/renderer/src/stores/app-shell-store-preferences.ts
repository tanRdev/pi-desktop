import type {
  AiPreferences,
  AppPreferences,
  ModelSwitchRequest,
  SettingsSnapshot,
} from "@pi-desktop/shared";
import {
  DEFAULT_AI_PREFERENCES,
  normalizeAiPreferences,
  readLegacySettings,
  readLegacySettingsStorage,
} from "../lib/app-preferences";
import {
  clampLeftSidebarWidth,
  DEFAULT_LEFT_SIDEBAR_WIDTH,
  readLegacyLeftSidebarWidth,
} from "../lib/sidebar-preferences";

export type StoredAiPreferences = {
  provider: string;
  model: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readLegacySettingsFromAppPreferences(
  preferences: AppPreferences | undefined,
) {
  if (!isRecord(preferences) || !("settings" in preferences)) {
    return null;
  }

  return readLegacySettings(preferences.settings);
}

export function getStoredAiPreferences(
  preferences: AppPreferences | undefined,
): StoredAiPreferences {
  if (preferences?.ai !== undefined && preferences.ai !== null) {
    return normalizeAiPreferences(preferences.ai);
  }

  return (
    readLegacySettingsFromAppPreferences(preferences)?.ai ??
    DEFAULT_AI_PREFERENCES
  );
}

export function normalizeAppPreferences(
  value: AppPreferences | undefined,
): AppPreferences {
  const legacySettings = readLegacySettingsFromAppPreferences(value);
  const resolvedLeftSidebarWidth =
    typeof value?.leftSidebarWidth === "number"
      ? clampLeftSidebarWidth(value.leftSidebarWidth)
      : typeof legacySettings?.leftSidebarWidth === "number"
        ? clampLeftSidebarWidth(legacySettings.leftSidebarWidth)
        : DEFAULT_LEFT_SIDEBAR_WIDTH;

  return {
    leftSidebarWidth: resolvedLeftSidebarWidth,
    ai: getStoredAiPreferences(value),
    favoriteModels: Array.isArray(value?.favoriteModels)
      ? value.favoriteModels
      : undefined,
  };
}

export function getSelectedModelValue(settings: SettingsSnapshot): {
  providerId: string | null;
  modelId: string | null;
} {
  return {
    providerId: settings.currentProviderId ?? settings.defaultProvider ?? null,
    modelId: settings.currentModelId ?? settings.defaultModel ?? null,
  };
}

export function buildAiPreferenceUpdate(
  preferences: AppPreferences,
  request: ModelSwitchRequest,
): Partial<AppPreferences> {
  const normalized = normalizeAppPreferences(preferences);

  return {
    ai: {
      ...normalizeAiPreferences(normalized.ai),
      provider: request.providerId,
      model: request.modelId,
    },
  };
}

export function getMigratedAppPreferences(
  preferences: AppPreferences | undefined,
): Partial<AppPreferences> {
  const migrated: Partial<AppPreferences> = {};
  const legacySettings =
    readLegacySettingsFromAppPreferences(preferences) ??
    readLegacySettingsStorage();

  if (preferences?.ai == null && legacySettings) {
    migrated.ai = legacySettings.ai;
  }

  if (preferences?.leftSidebarWidth == null) {
    const legacySidebarWidth = readLegacyLeftSidebarWidth();
    if (legacySidebarWidth !== null) {
      migrated.leftSidebarWidth = legacySidebarWidth;
    } else if (typeof legacySettings?.leftSidebarWidth === "number") {
      migrated.leftSidebarWidth = legacySettings.leftSidebarWidth;
    }
  }

  return migrated;
}

export function getEffectiveLeftSidebarWidth(
  preferences: AppPreferences,
): number {
  return (
    normalizeAppPreferences(preferences).leftSidebarWidth ??
    DEFAULT_LEFT_SIDEBAR_WIDTH
  );
}

export function mergeAppPreferences(
  base: AppPreferences,
  updates: Partial<AppPreferences>,
  response?: Partial<AppPreferences>,
): AppPreferences {
  const leftSidebarWidth =
    response?.leftSidebarWidth === undefined
      ? updates.leftSidebarWidth === undefined
        ? base.leftSidebarWidth
        : updates.leftSidebarWidth
      : response.leftSidebarWidth;
  const ai =
    response?.ai === undefined
      ? updates.ai === undefined
        ? base.ai
        : updates.ai
      : response.ai;
  const favoriteModels =
    response?.favoriteModels === undefined
      ? updates.favoriteModels === undefined
        ? base.favoriteModels
        : updates.favoriteModels
      : response.favoriteModels;

  return {
    ...(leftSidebarWidth === undefined ? {} : { leftSidebarWidth }),
    ...(ai === undefined ? {} : { ai }),
    ...(favoriteModels === undefined ? {} : { favoriteModels }),
  };
}

export function mergeAiPreferenceUpdates(
  currentAi: AiPreferences | null | undefined,
  nextAi: AiPreferences | null | undefined,
): StoredAiPreferences {
  if (nextAi === null) {
    return DEFAULT_AI_PREFERENCES;
  }

  if (nextAi === undefined) {
    return normalizeAiPreferences(currentAi);
  }

  const current = normalizeAiPreferences(currentAi);
  const next = normalizeAiPreferences(nextAi);

  return {
    provider: next.provider.length > 0 ? next.provider : current.provider,
    model: next.model.length > 0 ? next.model : current.model,
  };
}

export function normalizeAppPreferenceUpdates(
  updates: Partial<AppPreferences>,
  currentPreferences: AppPreferences,
): Partial<AppPreferences> {
  const currentNormalizedPreferences =
    normalizeAppPreferences(currentPreferences);
  const resolvedLeftSidebarWidth =
    typeof updates.leftSidebarWidth === "number"
      ? clampLeftSidebarWidth(updates.leftSidebarWidth)
      : getEffectiveLeftSidebarWidth(currentNormalizedPreferences);

  return {
    leftSidebarWidth: resolvedLeftSidebarWidth,
    ai: mergeAiPreferenceUpdates(currentNormalizedPreferences.ai, updates.ai),
    ...(updates.favoriteModels !== undefined
      ? { favoriteModels: updates.favoriteModels }
      : {}),
  };
}
