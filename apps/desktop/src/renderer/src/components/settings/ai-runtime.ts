import type { ProviderSnapshot, SettingsSnapshot } from "@pidesk/shared";

export interface RuntimeProviderOption {
  id: string;
  name: string;
  models: ProviderSnapshot["models"];
}

export function getRuntimeProviders(
  providers: ProviderSnapshot[],
): RuntimeProviderOption[] {
  return providers.filter(
    (provider) => provider.id !== "disabled" && provider.models.length > 0,
  );
}

export function getRuntimeSelection(
  providers: RuntimeProviderOption[],
  settingsSnapshot: SettingsSnapshot,
): {
  currentProvider: RuntimeProviderOption | null;
  currentModelId: string | null;
} {
  const currentProviderId =
    settingsSnapshot.currentProviderId ??
    settingsSnapshot.defaultProvider ??
    null;
  const currentProvider =
    providers.find((provider) => provider.id === currentProviderId) ?? null;

  return {
    currentProvider,
    currentModelId:
      settingsSnapshot.currentModelId ?? settingsSnapshot.defaultModel ?? null,
  };
}
