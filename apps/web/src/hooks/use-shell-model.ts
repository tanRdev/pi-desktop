import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getPiDeskApi } from "@/lib/api-bridge";
import { createShellModel, type ShellModelState } from "@/lib/shell-model";

// Create model lazily to ensure API is initialized
let modelInstance: ReturnType<typeof createShellModel> | null = null;

function getModel() {
  if (!modelInstance) {
    modelInstance = createShellModel(getPiDeskApi());
  }
  return modelInstance;
}

export function useShellModel() {
  const model = getModel();

  const state = useSyncExternalStore<ShellModelState>(
    model.subscribe,
    model.getState,
    model.getState,
  );

  useEffect(() => {
    void model.load();
    return () => model.dispose();
  }, [model]);

  const sendPrompt = useCallback(() => {
    model.sendPrompt();
  }, [model]);

  const setDraft = useCallback((draft: string) => {
    model.setDraft(draft);
  }, [model]);

  const reset = useCallback(async () => {
    const api = getPiDeskApi();
    try {
      await api.agent.reset();
    } catch {
      // A failed reset should still attempt to refresh snapshot state
    }

    try {
      await model.load();
    } catch {
      // Ignore snapshot refresh failures
    }

    model.setDraft("");
  }, [model]);

  return {
    state,
    sendPrompt,
    setDraft,
    reset,
  };
}
