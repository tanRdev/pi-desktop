import type {
  MentionSuggestion,
  ProviderSnapshot,
  SlashSuggestion,
} from "@pi-desktop/shared";
import * as React from "react";
import { getContextPercentage } from "./context-gauge";
import { getCurrentModelName } from "./model-picker";
import {
  builtInSlashSuggestions,
  dispatchPiCommand,
  findBuiltInBySlash,
} from "./slash-commands";

export interface PromptDockContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

export interface UsePromptDockDisplayOptions {
  draft: string;
  activeThreadId: string | null;
  autocompleteSuggestions: (SlashSuggestion | MentionSuggestion)[];
  onDraftChange: (draft: string) => void;
  onAutocompleteSelect: (
    suggestion: SlashSuggestion | MentionSuggestion,
  ) => void;
  providerSnapshots: ProviderSnapshot[];
  currentModelValue: string;
  contextUsage?: PromptDockContextUsage | null;
}

export interface PromptDockDisplayController {
  mergedSuggestions: (SlashSuggestion | MentionSuggestion)[];
  autocompleteVisible: boolean;
  handleAutocompleteSelect: (
    suggestion: SlashSuggestion | MentionSuggestion,
  ) => void;
  currentModelDisplay: string;
  currentContextWindow: number | null;
  currentContextTokens: number | null;
  currentContextPercentage: number | null;
}

function isSuggestionDetail(detail: unknown): detail is string {
  return typeof detail === "string";
}

export function usePromptDockDisplay({
  draft,
  activeThreadId,
  autocompleteSuggestions,
  onDraftChange,
  onAutocompleteSelect,
  providerSnapshots,
  currentModelValue,
  contextUsage = null,
}: UsePromptDockDisplayOptions): PromptDockDisplayController {
  const hasActiveThread = activeThreadId !== null;

  const mergedSuggestions = React.useMemo<
    (SlashSuggestion | MentionSuggestion)[]
  >(() => {
    const trimmed = draft.trimStart();
    if (!trimmed.startsWith("/")) return autocompleteSuggestions;

    const query = trimmed.slice(1).split(/\s/)[0] ?? "";
    const builtins = builtInSlashSuggestions(query);
    if (builtins.length === 0) return autocompleteSuggestions;

    const seen = new Set<string>();
    for (const suggestion of autocompleteSuggestions) {
      if (!("id" in suggestion)) {
        seen.add(suggestion.slash);
      }
    }

    const extras = builtins.filter((builtin) => !seen.has(builtin.slash));
    return [...autocompleteSuggestions, ...extras];
  }, [draft, autocompleteSuggestions]);

  const autocompleteVisible = mergedSuggestions.length > 0;

  const handleAutocompleteSelect = React.useCallback(
    (suggestion: SlashSuggestion | MentionSuggestion) => {
      if (!("id" in suggestion)) {
        const builtin = findBuiltInBySlash(suggestion.slash);
        if (builtin) {
          dispatchPiCommand(builtin);
          onDraftChange("");
          return;
        }
      }

      onAutocompleteSelect(suggestion);
    },
    [onAutocompleteSelect, onDraftChange],
  );

  React.useEffect(() => {
    function handleSuggestion(event: Event) {
      if (!hasActiveThread || !(event instanceof CustomEvent)) return;
      if (!isSuggestionDetail(event.detail)) return;
      onDraftChange(event.detail);
    }

    window.addEventListener("pi-chat-suggestion", handleSuggestion);
    return () =>
      window.removeEventListener("pi-chat-suggestion", handleSuggestion);
  }, [hasActiveThread, onDraftChange]);

  const currentModelDisplay = React.useMemo(
    () => getCurrentModelName(providerSnapshots, currentModelValue),
    [providerSnapshots, currentModelValue],
  );

  const currentContextWindow = contextUsage?.contextWindow ?? null;
  const currentContextTokens = contextUsage?.tokens ?? null;
  const currentContextPercentage =
    contextUsage?.percent ??
    (currentContextTokens !== null && currentContextWindow !== null
      ? getContextPercentage(currentContextTokens, currentContextWindow)
      : null);

  return {
    mergedSuggestions,
    autocompleteVisible,
    handleAutocompleteSelect,
    currentModelDisplay,
    currentContextWindow,
    currentContextTokens,
    currentContextPercentage,
  };
}
