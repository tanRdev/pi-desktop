import type { ProviderSnapshot, SettingsSnapshot } from "@pidesk/shared";
import {
  parseModelSelectionValue,
  resolveCurrentModelValue,
} from "../../hooks/use-shell-model";

function hasSelectableModels(provider: ProviderSnapshot): boolean {
  return provider.isConfigured !== false && provider.models.length > 0;
}

export function getRuntimeProviders(
  providerSnapshots: readonly ProviderSnapshot[],
): ProviderSnapshot[] {
  return providerSnapshots.filter(hasSelectableModels);
}

export function getRuntimeSelection(
  providerSnapshots: readonly ProviderSnapshot[],
  settingsSnapshot: SettingsSnapshot,
): { currentProvider: ProviderSnapshot | null; currentModelId: string } {
  const providers = getRuntimeProviders(providerSnapshots);
  if (providers.length === 0) {
    return { currentProvider: null, currentModelId: "" };
  }

  const selection = parseModelSelectionValue(
    resolveCurrentModelValue(providers, settingsSnapshot),
  );
  const currentProvider =
    providers.find((provider) => provider.id === selection?.providerId) ??
    providers[0] ??
    null;

  if (!currentProvider) {
    return { currentProvider: null, currentModelId: "" };
  }

  const currentModelId =
    currentProvider.models.find((model) => model.id === selection?.modelId)
      ?.id ??
    currentProvider.models[0]?.id ??
    "";

  return { currentProvider, currentModelId };
}
