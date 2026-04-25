import type {
  ModelSwitchRequest,
  PiDesktopAgentEvent,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";

import {
  mapSdkProviders,
  type ProviderModelLike,
} from "./pi-sdk-provider-snapshot.js";
import { mapThinkingLevel, type PiThinkingLevel } from "./pi-thinking-level.js";

type ModelRegistryLike = {
  getAvailable: () => ProviderModelLike[];
  refresh: () => void;
};

type SettingsLike = {
  defaultModel?: string;
  defaultProvider?: string;
  defaultThinkingLevel?: PiThinkingLevel;
};

type SettingsManagerLike = {
  getGlobalSettings: () => SettingsLike;
  getProjectSettings: () => SettingsLike;
  setDefaultProvider: (providerId: string) => void;
  setDefaultModel: (modelId: string) => void;
};

export function getSdkProviders(
  modelRegistry: ModelRegistryLike | null,
): ProviderSnapshot[] {
  if (!modelRegistry) {
    return [];
  }

  modelRegistry.refresh();

  return mapSdkProviders(modelRegistry.getAvailable());
}

export function getSdkSettings(
  settingsManager: SettingsManagerLike | null,
): SettingsSnapshot {
  if (!settingsManager) {
    return {};
  }

  const globalSettings = settingsManager.getGlobalSettings();
  const projectSettings = settingsManager.getProjectSettings();

  return {
    currentProviderId:
      projectSettings.defaultProvider ?? globalSettings.defaultProvider,
    currentModelId: projectSettings.defaultModel ?? globalSettings.defaultModel,
    defaultProvider: globalSettings.defaultProvider,
    defaultModel: globalSettings.defaultModel,
    thinkingLevel: mapThinkingLevel(
      projectSettings.defaultThinkingLevel ??
        globalSettings.defaultThinkingLevel,
    ),
  };
}

export function switchSdkModel(
  settingsManager: SettingsManagerLike | null,
  request: ModelSwitchRequest,
): Extract<PiDesktopAgentEvent, { type: "model_changed" }> {
  if (!settingsManager) {
    throw new Error("Settings manager not initialized");
  }

  settingsManager.setDefaultProvider(request.providerId);
  settingsManager.setDefaultModel(request.modelId);

  return {
    type: "model_changed",
    providerId: request.providerId,
    modelId: request.modelId,
  };
}

export type { ModelRegistryLike, SettingsManagerLike };
