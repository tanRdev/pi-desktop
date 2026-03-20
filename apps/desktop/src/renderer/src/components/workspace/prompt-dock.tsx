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
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import PromptAutocomplete from "../ui/prompt-autocomplete";

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000)
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1_000)
    return `${(tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1)}k`;
  return String(tokens);
}

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
  const [isFocused, setIsFocused] = React.useState(false);

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

  // Find current model's context window size
  const currentContextWindow = React.useMemo(() => {
    for (const provider of providerSnapshots) {
      for (const model of provider.models) {
        if (`${provider.id}::${model.id}` === currentModelValue) {
          return model.contextWindow ?? null;
        }
      }
    }
    return null;
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
    <div
      className={cn(
        "relative pb-4 pt-3",
        "transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
        !activeThreadId && "opacity-0 translate-y-8 pointer-events-none",
        activeThreadId && "opacity-100 translate-y-0",
      )}
    >
      <div className="mx-auto max-w-4xl px-6">
        <PromptInput
          value={draft}
          onValueChange={onDraftChange}
          onSubmit={() => void onSend()}
          className={cn(
            "shell-dock bg-[#0e0e0e] px-4 py-3 border border-[#474747]/30",
            "transition-all duration-100 ease-[var(--ease-out)]",
            isFocused && "border-white",
          )}
        >
          <PromptInputTextarea
            data-testid="chat-input"
            placeholder={
              activeThreadId ? "ASK_PI... (CMD + K)" : "SELECT_THREAD..."
            }
            disabled={!activeThreadId}
            onKeyDown={onPromptKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              "min-h-20 resize-none border-0 bg-transparent px-0.5 py-0.5 text-[11px] leading-tight font-mono uppercase",
              "text-white placeholder:text-[#474747]/50 outline-none",
              "focus-visible:border-transparent focus-visible:ring-0 disabled:opacity-50",
              "transition-colors duration-100 ease-[var(--ease-out)]",
            )}
          />
          <PromptAutocomplete
            visible={autocompleteSuggestions.length > 0}
            suggestions={autocompleteSuggestions}
            selectedIndex={autocompleteSelectedIndex}
            onSelect={onAutocompleteSelect}
            onHover={onAutocompleteHover}
            className="absolute left-0 right-0 top-full mt-2"
          />
          <PromptInputActions className="mt-2 items-center justify-between gap-3 border-t border-[#474747]/20 pt-2">
            <div className="flex items-center gap-1.5">
              <Popover open={modelOpen} onOpenChange={handleModelOpenChange}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={
                      isSwitchingModel || providerSnapshots.length === 0
                    }
                    className={cn(
                      "flex items-center gap-1.5 bg-[#1f1f1f] px-2 py-1 text-[9px] text-[#919191] font-mono uppercase tracking-widest border border-[#474747]/30",
                      "transition-all duration-100 ease-[var(--ease-out)]",
                      "hover:bg-white hover:text-black",
                      "focus-visible:outline-none",
                      "disabled:opacity-50",
                    )}
                  >
                    <span className="max-w-[120px] truncate">
                      {currentModelDisplay}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 opacity-70 transition-transform duration-100 ease-[var(--ease-out)]",
                        modelOpen && "rotate-180",
                      )}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="top"
                  sideOffset={8}
                  className="w-56 p-0 bg-[#2a2a2a] border border-[#474747] shadow-none"
                >
                  <div className="max-h-48 overflow-y-auto">
                    {providerSnapshots.map((provider, providerIndex) => (
                      <div key={provider.id} className="py-1">
                        <div className="px-2 py-1 text-[9px] font-bold text-[#474747] uppercase tracking-widest border-b border-[#474747]/10">
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
                              className={cn(
                                "w-full px-2 py-1.5 text-left text-[10px] font-mono uppercase",
                                "transition-all duration-100 ease-[var(--ease-out)]",
                                isSelected
                                  ? "bg-white text-black"
                                  : "text-[#919191] hover:bg-white hover:text-black",
                              )}
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
              {currentContextWindow != null ? (
                <span className="text-[9px] tabular-nums text-[#474747] font-mono uppercase">
                  {formatTokenCount(currentContextWindow)} CTX
                </span>
              ) : null}
              <PromptInputAction tooltip="EXECUTE_PROMPT">
                <Button
                  type="button"
                  data-testid="chat-send"
                  variant="default"
                  size="sm"
                  disabled={!canSend}
                  onClick={() => void onSend()}
                  className={cn(
                    "h-6 px-4 text-[10px] font-bold uppercase tracking-widest",
                    !canSend && "opacity-30",
                  )}
                >
                  EXECUTE
                </Button>
              </PromptInputAction>
            </div>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
