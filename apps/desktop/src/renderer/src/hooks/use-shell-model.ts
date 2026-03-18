import type { ProviderSnapshot, SettingsSnapshot } from "@pidesk/shared";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  type AppShellStoreState,
  getAppShellStore,
} from "../stores/app-shell-store";

export function useShellModel() {
  const store = getAppShellStore();
  const snapshot = useSyncExternalStore<AppShellStoreState>(
    store.subscribe,
    store.getState,
    store.getState,
  );

  useEffect(() => {
    void store.getState().initialize();
  }, [store]);

  const sendPrompt = useCallback(() => {
    return store.getState().sendPrompt();
  }, [store]);

  const setDraft = useCallback(
    (draft: string) => {
      store.getState().setDraft(draft);
    },
    [store],
  );

  const reset = useCallback(async () => {
    try {
      await window.pidesk.agent.reset();
    } catch (error) {
      // A failed reset should still attempt to refresh snapshot state so the
      // renderer can surface the latest runtime status without a full reload.
      store
        .getState()
        .shellModel.setAgentError(
          error instanceof Error ? error.message : "Reset failed",
        );
    }

    try {
      await store.getState().reload();
    } catch (error) {
      // Snapshot refresh failures are surfaced to the UI so users can see
      // that the session state may be stale.
      store
        .getState()
        .shellModel.setAgentError(
          error instanceof Error ? error.message : "Failed to load snapshot",
        );
    }

    store.getState().setDraft("");
  }, [store]);

  const reload = useCallback(async () => {
    try {
      await store.getState().reload();
    } catch (error) {
      store
        .getState()
        .shellModel.setAgentError(
          error instanceof Error ? error.message : "Failed to load snapshot",
        );
    }
  }, [store]);

  return {
    state: snapshot.shellState,
    providerSnapshots: snapshot.providerSnapshots,
    settingsSnapshot: snapshot.settingsSnapshot,
    appPreferences: snapshot.appPreferences,
    isSwitchingModel: snapshot.isSwitchingModel,
    switchModel: store.getState().switchModel,
    updateAppPreferences: store.getState().updateAppPreferences,
    updateRepositoryPreferences: store.getState().updateRepositoryPreferences,
    sendPrompt,
    setDraft,
    reset,
    reload,
  };
}

// Pure helpers expected by tests
export function parseModelSelectionValue(
  value: string,
): { providerId: string; modelId: string } | null {
  if (!value) return null;
  const parts = value.split("::");
  if (parts.length !== 2) return null;
  const [providerId, modelId] = parts;
  if (!providerId || !modelId) return null;
  return { providerId, modelId };
}

export function resolveCurrentModelValue(
  providers: ProviderSnapshot[],
  settings: SettingsSnapshot,
): string {
  const providerId =
    settings.currentProviderId ?? settings.defaultProvider ?? providers[0]?.id;
  const provider = providers.find((entry) => entry.id === providerId);
  const modelId =
    settings.currentModelId ?? settings.defaultModel ?? provider?.models[0]?.id;

  if (!providerId || !modelId) return "";
  return `${providerId}::${modelId}`;
}

export function reduceModelSelectionState(
  state: { isSwitchingModel: boolean },
  action: { type: "start" | "finish" },
) {
  switch (action.type) {
    case "start":
      return { ...state, isSwitchingModel: true };
    case "finish":
      return { ...state, isSwitchingModel: false };
    default:
      return state;
  }
}
