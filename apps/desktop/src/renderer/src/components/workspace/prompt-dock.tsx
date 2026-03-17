import type {
  MentionSuggestion,
  ProviderSnapshot,
  SlashSuggestion,
} from "@pidesk/shared";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@pidesk/ui";
import { ArrowUp } from "lucide-react";
import type * as React from "react";
import { Button } from "../ui/button";
import PromptAutocomplete from "../ui/prompt-autocomplete";

export interface PromptDockProps {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void | Promise<void>;
  activeThreadId: string | null;
  activeThreadTitle: string | null;
  canSend: boolean;
  autocompleteSuggestions: (SlashSuggestion | MentionSuggestion)[];
  autocompleteSelectedIndex: number;
  onAutocompleteSelect: (
    suggestion: SlashSuggestion | MentionSuggestion,
  ) => void;
  onAutocompleteHover: (index: number) => void;
  onPromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  displayAgentStatus: string;
  runtimeModeLabel: string;
  providerSnapshots: ProviderSnapshot[];
  currentModelValue: string;
  isSwitchingModel: boolean;
  onModelSelection: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void | Promise<void>;
}

export function PromptDock({
  draft,
  onDraftChange,
  onSend,
  activeThreadId,
  activeThreadTitle,
  canSend,
  autocompleteSuggestions,
  autocompleteSelectedIndex,
  onAutocompleteSelect,
  onAutocompleteHover,
  onPromptKeyDown,
  displayAgentStatus,
  runtimeModeLabel,
  providerSnapshots,
  currentModelValue,
  isSwitchingModel,
  onModelSelection,
}: PromptDockProps) {
  return (
    <div className="relative z-20 bg-gradient-to-t from-background to-transparent pb-6 pt-4">
      <div className="mx-auto max-w-4xl px-6">
        <PromptInput
          value={draft}
          onValueChange={onDraftChange}
          onSubmit={() => void onSend()}
          className="rounded-xl bg-surface-1/80 p-4 shadow-sm backdrop-blur-sm"
        >
          <PromptInputTextarea
            data-testid="chat-input"
            placeholder={
              activeThreadId
                ? "Ask Pi, use / for skills, @ for files or terminals..."
                : "Select a thread to start..."
            }
            disabled={!activeThreadId}
            onKeyDown={onPromptKeyDown}
            className="min-h-24 resize-none border-0 bg-transparent text-base leading-relaxed text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-0 disabled:opacity-50"
          />
          <PromptAutocomplete
            visible={autocompleteSuggestions.length > 0}
            suggestions={autocompleteSuggestions}
            selectedIndex={autocompleteSelectedIndex}
            onSelect={onAutocompleteSelect}
            onHover={onAutocompleteHover}
            className="absolute left-6 right-6 top-full mt-2"
          />
          <PromptInputActions className="mt-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                data-testid="agent-status"
                className="rounded border border-border bg-surface-1 px-2 py-1 text-[10px] text-muted-foreground"
              >
                {displayAgentStatus}
              </span>
              {activeThreadTitle ? (
                <span className="rounded border border-border bg-surface-1 px-2 py-1 text-[10px] text-muted-foreground">
                  Chat · {activeThreadTitle}
                </span>
              ) : null}
              <span className="rounded border border-border bg-surface-1 px-2 py-1 text-[10px] text-muted-foreground">
                {runtimeModeLabel}
              </span>
              <select
                value={currentModelValue}
                onChange={(event) => void onModelSelection(event)}
                disabled={isSwitchingModel || providerSnapshots.length === 0}
                className="rounded border border-border bg-surface-1 px-2 py-1 text-[10px] text-muted-foreground outline-none"
              >
                {providerSnapshots.map((provider) => (
                  <optgroup key={provider.id} label={provider.name}>
                    {provider.models.map((model) => (
                      <option
                        key={`${provider.id}:${model.id}`}
                        value={`${provider.id}::${model.id}`}
                      >
                        {model.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[0.7rem] text-zinc-500">Enter to send</span>
              <PromptInputAction tooltip="Send message">
                <Button
                  type="button"
                  data-testid="chat-send"
                  variant="ghost"
                  size="icon"
                  disabled={!canSend}
                  onClick={() => void onSend()}
                  className="size-8 rounded-lg border border-white/8 bg-white/[0.06] text-zinc-200 hover:bg-white/[0.10] disabled:opacity-50"
                >
                  <ArrowUp className="size-4" />
                </Button>
              </PromptInputAction>
            </div>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
