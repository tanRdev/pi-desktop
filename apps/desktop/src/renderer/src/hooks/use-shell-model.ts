import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createShellModel, type ShellModelState } from "../lib/shell-model";

const model = createShellModel(window.pidesk);

export function useShellModel() {
  const state = useSyncExternalStore<ShellModelState>(
    model.subscribe,
    model.getState,
    model.getState,
  );

  useEffect(() => {
    void model.load();
    return () => model.dispose();
  }, []);

  const sendPrompt = useCallback(() => {
    model.sendPrompt();
  }, []);

  const setDraft = useCallback((draft: string) => {
    model.setDraft(draft);
  }, []);

  const reset = useCallback(async () => {
    try {
      await window.pidesk.agent.reset();
    } catch {
      // A failed reset should still attempt to refresh snapshot state so the
      // renderer can surface the latest runtime status without a full reload.
    }

    try {
      await model.load();
    } catch {
      // Ignore snapshot refresh failures here; the existing model state remains
      // visible and any future successful load will reconcile the session.
    }

    model.setDraft("");
  }, []);

  return {
    state,
    sendPrompt,
    setDraft,
    reset,
  };
}
