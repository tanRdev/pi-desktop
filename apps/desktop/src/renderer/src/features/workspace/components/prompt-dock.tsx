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
import { Button } from "@/components/ui/button";
import { ICON_SIZE_XS, Paperclip } from "@/components/ui/icons";
import { Loader } from "@/components/ui/loader";
import PromptAutocomplete from "@/components/ui/prompt-autocomplete";
import { cn } from "@/lib/utils";
import { Attachments, useAttachments } from "./prompt-dock/attachments";
import { CharacterCounter } from "./prompt-dock/character-counter";
import { ContextGauge } from "./prompt-dock/context-gauge";
import { ContextUsageMeter } from "./prompt-dock/context-usage-meter";
import { ModelPicker } from "./prompt-dock/model-picker";
import { usePersistDraft } from "./prompt-dock/prompt-draft";
import { SendButton } from "./prompt-dock/send-button";
import { usePromptDockDisplay } from "./prompt-dock/use-prompt-dock-display";
import { usePromptDockInput } from "./prompt-dock/use-prompt-dock-input";

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

  usePersistDraft(activeThreadId, draft);

  const {
    mergedSuggestions,
    autocompleteVisible,
    handleAutocompleteSelect,
    currentModelDisplay,
    currentContextWindow,
    currentContextTokens,
    currentContextPercentage,
  } = usePromptDockDisplay({
    draft,
    activeThreadId,
    autocompleteSuggestions,
    onDraftChange,
    onAutocompleteSelect,
    providerSnapshots,
    currentModelValue,
    contextUsage,
  });

  const { handleImagePaste, handleSubmit, handlePromptKeyDown } =
    usePromptDockInput({
      activeThreadId,
      draft,
      isPromptExecuting,
      autocompleteVisible,
      onDraftChange,
      onSend,
      onCancelPrompt,
      onPromptKeyDown,
    });

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
            onImagePaste={handleImagePaste}
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
