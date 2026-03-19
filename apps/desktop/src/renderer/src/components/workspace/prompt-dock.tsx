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
import { ArrowUp, ChevronDown } from "lucide-react";
import * as React from "react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
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
  onModelMenuOpenChange?: (open: boolean) => void | Promise<void>;
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
  onModelMenuOpenChange,
  onModelSelection,
}: PromptDockProps) {
  const [modelOpen, setModelOpen] = React.useState(false);

  // Find current model display name
  const currentModelDisplay = React.useMemo(() => {
    for (const provider of providerSnapshots) {
      for (const model of provider.models) {
        if (`${provider.id}::${model.id}` === currentModelValue) {
          return model.name;
        }
      }
    }
    return "Select model";
  }, [providerSnapshots, currentModelValue]);

  const handleModelSelect = (value: string) => {
    const event = {
      target: { value },
    } as React.ChangeEvent<HTMLSelectElement>;
    void onModelSelection(event);
    setModelOpen(false);
  };

  const handleModelOpenChange = (nextOpen: boolean) => {
    setModelOpen(nextOpen);
    if (nextOpen) {
      void onModelMenuOpenChange?.(nextOpen);
    }
  };

  return (
    <div className="relative z-20 bg-background pb-4 pt-3">
      <div className="mx-auto max-w-4xl px-6">
        <PromptInput
          value={draft}
          onValueChange={onDraftChange}
          onSubmit={() => void onSend()}
          className="shell-dock bg-surface-1 px-4 py-3"
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
            className="min-h-20 resize-none border-0 bg-transparent px-0.5 py-0.5 text-[13px] leading-6 text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-transparent focus-visible:ring-0 disabled:opacity-50"
          />
          <PromptAutocomplete
            visible={autocompleteSuggestions.length > 0}
            suggestions={autocompleteSuggestions}
            selectedIndex={autocompleteSelectedIndex}
            onSelect={onAutocompleteSelect}
            onHover={onAutocompleteHover}
            className="absolute left-0 right-0 top-full mt-2"
          />
          <PromptInputActions className="mt-2 items-center justify-between gap-3 border-t border-border-subtle pt-2">
            <div className="flex items-center gap-1.5">
              <span
                data-testid="agent-status"
                data-runtime-mode={runtimeModeLabel}
                aria-live="polite"
                className="shell-token sr-only"
              >
                {displayAgentStatus}
              </span>
              <Popover open={modelOpen} onOpenChange={handleModelOpenChange}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={
                      isSwitchingModel || providerSnapshots.length === 0
                    }
                    className="flex items-center gap-1.5 rounded-sm bg-surface-2/80 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
                  >
                    <span className="max-w-[120px] truncate">
                      {currentModelDisplay}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="top"
                  sideOffset={8}
                  className="w-56 p-1"
                >
                  <div className="max-h-48 overflow-y-auto">
                    {providerSnapshots.map((provider) => (
                      <div key={provider.id} className="py-1">
                        <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {provider.name}
                        </div>
                        {provider.models.map((model) => {
                          const value = `${provider.id}::${model.id}`;
                          const isSelected = value === currentModelValue;
                          return (
                            <button
                              key={`${provider.id}:${model.id}`}
                              type="button"
                              onClick={() => handleModelSelect(value)}
                              className={`w-full rounded-sm px-2 py-1.5 text-left text-[11px] transition-colors ${
                                isSelected
                                  ? "bg-surface-2 text-foreground"
                                  : "text-muted-foreground hover:bg-surface-1 hover:text-foreground"
                              }`}
                            >
                              {model.name}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2.5">
              <PromptInputAction tooltip="Send message">
                <Button
                  type="button"
                  data-testid="chat-send"
                  variant="ghost"
                  size="icon"
                  disabled={!canSend}
                  onClick={() => void onSend()}
                  className="shell-send-button size-8 rounded-sm border border-border-subtle bg-surface-2 text-foreground transition-colors hover:bg-surface-3 disabled:opacity-50"
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
