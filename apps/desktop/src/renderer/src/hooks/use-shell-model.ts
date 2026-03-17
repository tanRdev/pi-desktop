import type { ProviderSnapshot, SettingsSnapshot } from "@pidesk/shared";
import { createShellModel, type ShellModelState } from "@pidesk/shell-model";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

export function useShellModel() {
  const model = useMemo(() => createShellModel(window.pidesk), []);
  const state = useSyncExternalStore<ShellModelState>(
    model.subscribe,
    model.getState,
    model.getState,
  );

  useEffect(() => {
    void model.load();
    return () => model.dispose();
  }, [model.dispose, model.load]);

  const sendPrompt = useCallback(() => {
    model.sendPrompt();
  }, [model.sendPrompt]);

  const setDraft = useCallback(
    (draft: string) => {
      model.setDraft(draft);
    },
    [model.setDraft],
  );

  const reset = useCallback(async () => {
    try {
      await window.pidesk.agent.reset();
    } catch (error) {
      // A failed reset should still attempt to refresh snapshot state so the
      // renderer can surface the latest runtime status without a full reload.
      model.setAgentError(
        error instanceof Error ? error.message : "Reset failed",
      );
    }

    try {
      await model.load();
    } catch (error) {
      // Snapshot refresh failures are surfaced to the UI so users can see
      // that the session state may be stale.
      model.setAgentError(
        error instanceof Error ? error.message : "Failed to load snapshot",
      );
    }

    model.setDraft("");
  }, [model]);

  const reload = useCallback(async () => {
    try {
      await model.load();
    } catch (error) {
      model.setAgentError(
        error instanceof Error ? error.message : "Failed to load snapshot",
      );
    }
  }, [model]);

  return {
    state,
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
