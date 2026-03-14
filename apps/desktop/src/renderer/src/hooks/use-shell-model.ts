import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { createShellModel, type ShellModelState } from "../lib/shell-model";

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

  return {
    state,
    sendPrompt,
    setDraft,
    reset,
  };
}
