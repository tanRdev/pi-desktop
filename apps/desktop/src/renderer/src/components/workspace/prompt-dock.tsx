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
import { ChevronDown, Square } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { buildFileMention } from "../../lib/prompt-routing";
import { Button } from "../ui/button";
import { FileUpload, type UploadedFile } from "../ui/file-upload";
import { Image } from "../ui/image";
import { Loader } from "../ui/loader";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import PromptAutocomplete from "../ui/prompt-autocomplete";
import {
  PromptSuggestion,
  PromptSuggestionGroup,
} from "../ui/prompt-suggestion";
import { TextShimmer } from "../ui/text-shimmer";

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1)}k`;
  }
  return String(tokens);
}

function isImagePath(filePath: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(filePath);
}

const DEFAULT_PROMPT_SUGGESTIONS = [
  {
    title: "Map this repo",
    description: "Summarize the architecture and identify the fastest way in.",
    value:
      "Map this repository and tell me the fastest way to start changing it.",
  },
  {
    title: "Tighten the UI",
    description: "Review the current surface and propose the sharpest cleanup.",
    value:
      "Audit the current UI, call out the weakest spots, and propose targeted fixes.",
  },
  {
    title: "Ship a fix",
    description: "Describe the bug, write the failing test, and make it pass.",
    value:
      "Reproduce the current bug with a failing test first, then implement the fix.",
  },
];

export interface PromptDockProps {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void | Promise<void>;
  onCancelPrompt: () => void | Promise<void>;
  activeThreadId: string | null;
  activeThreadTitle: string | null;
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
  onCancelPrompt,
  activeThreadId,
  activeThreadTitle,
  canSend,
  isVisible,
  isPromptExecuting,
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
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([]);
  const hasActiveThread = activeThreadId !== null;

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

  const imageFiles = React.useMemo(
    () => uploadedFiles.filter((file) => file.kind === "image"),
    [uploadedFiles],
  );

  const showPromptSuggestions = hasActiveThread && draft.trim().length === 0;

  const handleModelSelect = React.useCallback(
    (value: string) => {
      const event = {
        target: { value },
      } as React.ChangeEvent<HTMLSelectElement>;
      void onModelSelection(event);
      setModelOpen(false);
    },
    [onModelSelection],
  );

  const handleModelOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setModelOpen(nextOpen);
      if (nextOpen) {
        void onModelMenuOpenChange?.(nextOpen);
      }
    },
    [onModelMenuOpenChange],
  );

  const handlePickFiles = React.useCallback(async () => {
    const selectedPaths = await window.pidesk.dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      title: "Attach files to prompt",
    });

    if (!selectedPaths || selectedPaths.length === 0) {
      return;
    }

    setUploadedFiles((currentFiles) => {
      const nextFiles = [...currentFiles];

      for (const filePath of selectedPaths) {
        if (nextFiles.some((file) => file.path === filePath)) {
          continue;
        }

        nextFiles.push({
          id: `${Date.now()}-${filePath}`,
          name: filePath.split(/[/\\]/).pop() ?? filePath,
          path: filePath,
          kind: isImagePath(filePath) ? "image" : "file",
        });
      }

      return nextFiles;
    });

    const nextMentions = selectedPaths
      .map((filePath) => buildFileMention(filePath))
      .filter((mention) => !draft.includes(mention))
      .join("");

    if (nextMentions.length > 0) {
      onDraftChange(
        `${draft}${draft.endsWith(" ") || draft.length === 0 ? "" : " "}${nextMentions}`,
      );
    }
  }, [draft, onDraftChange]);

  const handleRemoveFile = React.useCallback(
    (fileId: string) => {
      setUploadedFiles((currentFiles) => {
        const removedFile = currentFiles.find((file) => file.id === fileId);

        if (removedFile) {
          const nextDraft = draft
            .split(buildFileMention(removedFile.path))
            .join("")
            .replace(/\s{2,}/g, " ")
            .trimStart();

          if (nextDraft !== draft) {
            onDraftChange(nextDraft);
          }
        }

        return currentFiles.filter((file) => file.id !== fileId);
      });
    },
    [draft, onDraftChange],
  );

  const handleSuggestionSelect = React.useCallback(
    (value: string) => {
      onDraftChange(value);
    },
    [onDraftChange],
  );

  const threadLabel = activeThreadTitle?.trim() || "Active thread";
  const modeLabel = runtimeModeLabel.trim() || "Command";
  const agentLabel = displayAgentStatus.trim() || "Idle";

  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        "relative",
        "transition-[max-height,padding] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "motion-reduce:transition-none",
        isVisible ? "max-h-[42rem] pb-5 pt-3" : "max-h-0 pb-0 pt-0",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 top-0 bg-[linear-gradient(180deg,rgba(19,19,19,0)_0%,rgba(19,19,19,0.56)_24%,rgba(11,11,11,0.98)_100%)]",
          "transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isVisible ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "relative mx-auto w-full max-w-[44rem] px-4",
          "transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
          "motion-reduce:transition-none",
          isVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-10 opacity-0 pointer-events-none",
        )}
      >
        <PromptInput
          value={draft}
          onValueChange={onDraftChange}
          onSubmit={() => void onSend()}
          className={cn(
            "shell-dock px-4 pb-3 pt-3",
            "bg-[linear-gradient(180deg,rgba(13,13,13,0.84)_0%,rgba(8,8,8,0.98)_100%)]",
            "border-[#474747]/15 backdrop-blur-[1px]",
            "transition-[border-color,background-color] duration-150 ease-[var(--ease-out)]",
            isFocused && "border-white/60",
          )}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-[0.12em] text-[#6f6f6f]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-[#8b8b8b]">Thread</span>
              <span className="truncate text-[10px] tracking-[0.08em] text-white/72 normal-case">
                {threadLabel}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
              <span>{modeLabel}</span>
              <span className="text-white/25">/</span>
              {isSwitchingModel ? (
                <Loader label="Switching" />
              ) : (
                <TextShimmer className="text-[9px] uppercase tracking-[0.12em] text-white/58">
                  {agentLabel}
                </TextShimmer>
              )}
            </div>
          </div>

          {showPromptSuggestions ? (
            <PromptSuggestionGroup className="mb-2">
              {DEFAULT_PROMPT_SUGGESTIONS.map((suggestion) => (
                <PromptSuggestion
                  key={suggestion.title}
                  title={suggestion.title}
                  description={suggestion.description}
                  onClick={() => handleSuggestionSelect(suggestion.value)}
                />
              ))}
            </PromptSuggestionGroup>
          ) : null}

          <FileUpload
            files={uploadedFiles}
            disabled={!hasActiveThread}
            onPickFiles={handlePickFiles}
            onRemoveFile={handleRemoveFile}
            className="mb-3"
          />

          {imageFiles.length > 0 ? (
            <div className="mb-3 grid grid-cols-2 gap-2">
              {imageFiles.slice(0, 2).map((file) => (
                <Image
                  key={file.id}
                  src={`file://${file.path}`}
                  alt={file.name}
                  aspect="landscape"
                />
              ))}
            </div>
          ) : null}

          <PromptInputTextarea
            data-testid="chat-input"
            placeholder={
              hasActiveThread ? "ASK_PI... (CMD + K)" : "SELECT_THREAD..."
            }
            disabled={!hasActiveThread}
            onKeyDown={onPromptKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              "min-h-[84px] resize-none border-0 border-b border-[#474747]/24 bg-transparent px-0 py-0 pb-2",
              "text-[11px] leading-[1.4] font-mono uppercase tracking-[0.04em] text-white",
              "placeholder:text-[#5a5a5a] outline-none",
              "focus-visible:border-b focus-visible:border-white/55 focus-visible:ring-0 disabled:opacity-50",
              "transition-colors duration-100 ease-[var(--ease-out)]",
            )}
          />

          <PromptAutocomplete
            visible={autocompleteSuggestions.length > 0}
            suggestions={autocompleteSuggestions}
            selectedIndex={autocompleteSelectedIndex}
            onSelect={onAutocompleteSelect}
            onHover={onAutocompleteHover}
            className="absolute left-0 right-0 top-full z-20 mt-2"
          />

          <PromptInputActions className="mt-2 items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <PromptInputAction tooltip="MODEL_ROUTER">
                <Popover open={modelOpen} onOpenChange={handleModelOpenChange}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={
                        !hasActiveThread ||
                        isSwitchingModel ||
                        providerSnapshots.length === 0
                      }
                      className={cn(
                        "flex items-center gap-1.5 bg-[#181818] px-2 py-1 text-[9px] text-[#919191] font-mono uppercase tracking-[0.22em] border border-[#474747]/20",
                        "transition-all duration-100 ease-[var(--ease-out)]",
                        "hover:border-white/50 hover:bg-white hover:text-black",
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
                    className="w-56 border border-[#474747] bg-[#2a2a2a] p-0 shadow-none"
                  >
                    <div className="max-h-48 overflow-y-auto">
                      {providerSnapshots.map((provider) => (
                        <div key={provider.id} className="py-1">
                          <div className="border-b border-[#474747]/10 px-2 py-1 text-[9px] font-bold text-[#474747] uppercase tracking-widest">
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
              </PromptInputAction>
              <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-[#5f5f5f]">
                Canvas input
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {currentContextWindow != null ? (
                <span className="text-[9px] tabular-nums text-[#626262] font-mono uppercase tracking-[0.08em]">
                  {formatTokenCount(currentContextWindow)} CTX
                </span>
              ) : null}
              <PromptInputAction
                tooltip={isPromptExecuting ? "STOP_PROMPT" : "EXECUTE_PROMPT"}
              >
                <Button
                  type="button"
                  data-testid="chat-send"
                  variant={isPromptExecuting ? "destructive" : "default"}
                  size="sm"
                  disabled={isPromptExecuting ? false : !canSend}
                  onClick={() =>
                    void (isPromptExecuting ? onCancelPrompt() : onSend())
                  }
                  className={cn(
                    "h-6 px-4 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
                    !isPromptExecuting && !canSend && "opacity-30",
                  )}
                >
                  {isPromptExecuting ? (
                    <Square className="size-3 fill-current" />
                  ) : null}
                  {isPromptExecuting ? "STOP" : "EXECUTE"}
                </Button>
              </PromptInputAction>
            </div>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
