import type {
  MentionSuggestion,
  ProviderSnapshot,
  SlashSuggestion,
} from "@pi-desktop/shared";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@pi-desktop/ui";
import * as React from "react";
import { ICON_SIZE_XS, Paperclip } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Loader } from "../ui/loader";
import PromptAutocomplete from "../ui/prompt-autocomplete";
import { Attachments, useAttachments } from "./prompt-dock/attachments";
import { CharacterCounter } from "./prompt-dock/character-counter";
import {
  ContextGauge,
  getContextPercentage,
} from "./prompt-dock/context-gauge";
import { ContextUsageMeter } from "./prompt-dock/context-usage-meter";
import { getCurrentModelName, ModelPicker } from "./prompt-dock/model-picker";
import { usePersistDraft } from "./prompt-dock/prompt-draft";
import { usePromptHistory } from "./prompt-dock/prompt-history";
import { SendButton } from "./prompt-dock/send-button";
import {
  builtInSlashSuggestions,
  dispatchPiCommand,
  findBuiltInBySlash,
} from "./prompt-dock/slash-commands";

export type PromptMode = "build" | "plan";

export interface PromptDockProps {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void | Promise<void>;
  onCancelPrompt: () => void | Promise<void>;
  activeThreadId: string | null;
  canSend: boolean;
  isVisible: boolean;
  isPromptExecuting: boolean;
  autocompleteSuggestions: (SlashSuggestion | MentionSuggestion)[];
  autocompleteSelectedIndex: number;
  onAutocompleteSelect: (
    suggestion: SlashSuggestion | MentionSuggestion,
  ) => void;
  onAutocompleteHover: (index: number) => void;
  onPromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  displayAgentStatus?: string;
  runtimeModeLabel?: string;
  providerSnapshots: ProviderSnapshot[];
  currentModelValue: string;
  contextUsage?: {
    tokens: number | null;
    contextWindow: number;
    percent: number | null;
  } | null;
  isSwitchingModel: boolean;
  promptMode?: PromptMode;
  onPromptModeChange?: (mode: PromptMode) => void;
  onModelMenuOpenChange?: (open: boolean) => void | Promise<void>;
  onModelSelection: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void | Promise<void>;
  onConnectProvider?: () => void;
  favoriteModels?: string[];
  onToggleFavorite?: (modelValue: string) => void;
}

export function PromptDock({
  draft,
  onDraftChange,
  onSend,
  onCancelPrompt,
  activeThreadId,
  canSend,
  isVisible,
  isPromptExecuting,
  autocompleteSuggestions,
  autocompleteSelectedIndex,
  onAutocompleteSelect,
  onAutocompleteHover,
  onPromptKeyDown,
  displayAgentStatus: _displayAgentStatus,
  runtimeModeLabel: _runtimeModeLabel,
  providerSnapshots,
  currentModelValue,
  contextUsage = null,
  isSwitchingModel,
  promptMode: _promptMode = "build",
  onPromptModeChange: _onPromptModeChange,
  onModelMenuOpenChange,
  onModelSelection,
  onConnectProvider,
  favoriteModels = [],
  onToggleFavorite,
}: PromptDockProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const hasActiveThread = activeThreadId !== null;

  const { uploadedFiles, imageFiles, handlePickFiles, handleRemoveFile } =
    useAttachments(draft, onDraftChange);

  const history = usePromptHistory(activeThreadId);
  usePersistDraft(activeThreadId, draft);

  // Merge built-in slash commands into suggestions when the user is typing a
  // slash query. External suggestions (from IPC) take priority; built-ins are
  // appended and de-duped by slash text.
  const mergedSuggestions = React.useMemo<
    (SlashSuggestion | MentionSuggestion)[]
  >(() => {
    const trimmed = draft.trimStart();
    if (!trimmed.startsWith("/")) return autocompleteSuggestions;

    const query = trimmed.slice(1).split(/\s/)[0] ?? "";
    const builtins = builtInSlashSuggestions(query);
    if (builtins.length === 0) return autocompleteSuggestions;

    const seen = new Set<string>();
    for (const s of autocompleteSuggestions) {
      if (!("id" in s)) seen.add(s.slash);
    }
    const extras = builtins.filter((b) => !seen.has(b.slash));
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

  // Listen for suggestion chip clicks from the empty chat state.
  React.useEffect(() => {
    function handleSuggestion(event: Event) {
      const custom = event as CustomEvent<string>;
      if (!hasActiveThread || typeof custom.detail !== "string") return;
      onDraftChange(custom.detail);
    }
    window.addEventListener("pi-chat-suggestion", handleSuggestion);
    return () =>
      window.removeEventListener("pi-chat-suggestion", handleSuggestion);
  }, [hasActiveThread, onDraftChange]);

  const currentModelDisplay = getCurrentModelName(
    providerSnapshots,
    currentModelValue,
  );

  const currentContextWindow = contextUsage?.contextWindow ?? null;
  const currentContextTokens = contextUsage?.tokens ?? null;
  const currentContextPercentage =
    contextUsage?.percent ??
    (currentContextTokens !== null && currentContextWindow !== null
      ? getContextPercentage(currentContextTokens, currentContextWindow)
      : null);

  const handleSubmit = React.useCallback(() => {
    if (!isPromptExecuting && draft.trim().length > 0) {
      history.push(draft);
    }
    void (isPromptExecuting ? onCancelPrompt() : onSend());
  }, [isPromptExecuting, onCancelPrompt, onSend, history, draft]);

  const handlePromptKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter submit (in addition to plain Enter handled upstream).
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleSubmit();
        onPromptKeyDown(event);
        return;
      }

      // Arrow history cycling: only when autocomplete is hidden, nothing
      // modifier-y is held, and the user has not selected text.
      if (
        !autocompleteVisible &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        const target = event.currentTarget;
        if (event.key === "ArrowUp") {
          const atStart =
            target.selectionStart === 0 && target.selectionEnd === 0;
          if (atStart) {
            const prev = history.previous(draft);
            if (prev !== null) {
              event.preventDefault();
              onDraftChange(prev);
              onPromptKeyDown(event);
              return;
            }
          }
        } else {
          const atEnd =
            target.selectionStart === target.value.length &&
            target.selectionEnd === target.value.length;
          if (atEnd) {
            const nxt = history.next();
            if (nxt !== null) {
              event.preventDefault();
              onDraftChange(nxt);
              onPromptKeyDown(event);
              return;
            }
          }
        }
      }

      // Any other typing resets the history cursor.
      if (event.key.length === 1 || event.key === "Backspace") {
        history.reset();
      }

      onPromptKeyDown(event);
    },
    [
      autocompleteVisible,
      draft,
      handleSubmit,
      history,
      onDraftChange,
      onPromptKeyDown,
    ],
  );

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            window.dispatchEvent(
              new CustomEvent("pi:paste-image", { detail: file }),
            );
            return;
          }
        }
      }
    },
    [],
  );

  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        "relative mx-auto w-full max-w-3xl overflow-visible border-t border-l border-r border-white/[0.08] bg-[var(--color-bg-primary)] select-none -mb-1",
        "transition-[max-height,opacity] duration-[var(--duration-slow)] ease-out",
        isVisible ? "max-h-[42rem]" : "max-h-0 overflow-hidden opacity-0",
      )}
    >
      <div
        className={cn(
          "relative w-full transition-[transform,opacity] duration-[var(--duration-slow)] ease-out select-none",
          isVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0 pointer-events-none",
        )}
      >
        <PromptAutocomplete
          visible={autocompleteVisible}
          suggestions={mergedSuggestions}
          selectedIndex={autocompleteSelectedIndex}
          onSelect={handleAutocompleteSelect}
          onHover={onAutocompleteHover}
          className="absolute bottom-full left-0 right-0 z-20 mb-2"
        />

        <PromptInput
          value={draft}
          onValueChange={onDraftChange}
          onSubmit={handleSubmit}
          className={cn("px-6 pb-3 pt-3")}
        >
          <Attachments
            uploadedFiles={uploadedFiles}
            imageFiles={imageFiles}
            disabled={!hasActiveThread}
            onPickFiles={handlePickFiles}
            onRemoveFile={handleRemoveFile}
          />

          <PromptInputTextarea
            data-testid="chat-input"
            placeholder={
              hasActiveThread
                ? "Ask Pi to inspect, plan, fix, or ship…"
                : "Select a thread to start typing…"
            }
            disabled={!hasActiveThread}
            onKeyDown={handlePromptKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              "min-h-[28px] resize-none border-0 bg-transparent px-0 py-0",
              "text-[10.5px] leading-normal text-[var(--color-text-primary)]",
              "placeholder:text-[var(--color-text-tertiary)]",
              "focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
              "disabled:opacity-50",
              isFocused && "placeholder:text-[var(--color-text-quaternary)]",
            )}
          />

          <PromptInputActions className="mt-1.5 flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PromptInputAction tooltip="Attach files">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={!hasActiveThread}
                  onClick={() => void handlePickFiles()}
                  aria-label="Attach files"
                  className="size-5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                >
                  <Paperclip className={ICON_SIZE_XS} />
                </Button>
              </PromptInputAction>

              <ModelPicker
                providerSnapshots={providerSnapshots}
                currentModelValue={currentModelValue}
                isSwitchingModel={isSwitchingModel}
                disabled={!hasActiveThread}
                favoriteModels={favoriteModels}
                onModelSelection={onModelSelection}
                onModelMenuOpenChange={onModelMenuOpenChange}
                onConnectProvider={onConnectProvider}
                onToggleFavorite={onToggleFavorite}
              />
            </div>

            <div className="flex items-center gap-[var(--space-3)]">
              {isSwitchingModel ? <Loader label="Switching" /> : null}

              <CharacterCounter value={draft} />

              {currentContextWindow != null &&
              currentContextPercentage !== null ? (
                <ContextGauge
                  tokens={currentContextTokens}
                  contextWindow={currentContextWindow}
                  percent={currentContextPercentage}
                  modelDisplayName={currentModelDisplay}
                />
              ) : null}

              {currentContextWindow != null &&
              currentContextPercentage !== null ? (
                <ContextUsageMeter
                  tokens={currentContextTokens}
                  contextWindow={currentContextWindow}
                  percent={currentContextPercentage}
                />
              ) : null}

              <SendButton
                isPromptExecuting={isPromptExecuting}
                canSend={canSend}
                draft={draft}
                onSubmit={handleSubmit}
              />
            </div>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
