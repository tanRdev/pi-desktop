import { Brain, CaretDown, Paperclip, Square } from "@phosphor-icons/react";
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
import * as React from "react";
import { cn } from "@/lib/utils";
import { buildFileMention } from "../../lib/prompt-routing";
import { Button } from "../ui/button";
import { FileUpload, type UploadedFile } from "../ui/file-upload";
import { Image } from "../ui/image";
import { Loader } from "../ui/loader";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import PromptAutocomplete from "../ui/prompt-autocomplete";

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1)}K`;
  }
  return String(tokens);
}

function getContextPercentage(tokens: number): number {
  // Standard context window is 128K for most models
  const standardContext = 128_000;
  return Math.min(100, Math.round((tokens / standardContext) * 100));
}

function isImagePath(filePath: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(filePath);
}

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

  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        "relative mt-auto w-full border-t border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]",
        "transition-[max-height,opacity] duration-[var(--duration-slow)] ease-out",
        isVisible ? "max-h-[42rem]" : "max-h-0 overflow-hidden opacity-0",
      )}
    >
      <div
        className={cn(
          "relative w-full transition-[transform,opacity] duration-[var(--duration-slow)] ease-out",
          isVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-4 opacity-0 pointer-events-none",
        )}
      >
        <PromptInput
          value={draft}
          onValueChange={onDraftChange}
          onSubmit={() =>
            void (isPromptExecuting ? onCancelPrompt() : onSend())
          }
          className={cn(
            "border-0 bg-transparent",
            "px-[var(--space-4)] pb-[var(--space-4)] pt-[var(--space-4)]",
          )}
        >
          <FileUpload
            files={uploadedFiles}
            disabled={!hasActiveThread}
            onPickFiles={handlePickFiles}
            onRemoveFile={handleRemoveFile}
            className="mb-[var(--space-3)]"
          />

          {imageFiles.length > 0 ? (
            <div className="mb-[var(--space-3)] grid grid-cols-2 gap-[var(--space-2)]">
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
              hasActiveThread
                ? "Ask PiDesk to inspect, plan, fix, or ship…"
                : "Select a thread to start typing…"
            }
            disabled={!hasActiveThread}
            onKeyDown={onPromptKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              "min-h-[80px] resize-none border-0 bg-transparent px-0 py-0 pb-[var(--space-2)]",
              "text-sm leading-relaxed text-[var(--color-text-primary)]",
              "placeholder:text-[var(--color-text-tertiary)]",
              "focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
              "disabled:opacity-50",
              isFocused && "placeholder:text-[var(--color-text-quaternary)]",
            )}
          />

          <PromptAutocomplete
            visible={autocompleteSuggestions.length > 0}
            suggestions={autocompleteSuggestions}
            selectedIndex={autocompleteSelectedIndex}
            onSelect={onAutocompleteSelect}
            onHover={onAutocompleteHover}
            className="absolute left-0 right-0 top-full z-20 mt-[var(--space-2)]"
          />

          <PromptInputActions className="mt-[var(--space-2)] items-center justify-between gap-[var(--space-3)] pt-[var(--space-2)] border-t border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <PromptInputAction tooltip="Attach files">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={!hasActiveThread}
                  onClick={() => void handlePickFiles()}
                  aria-label="Attach files"
                  title="Attach files"
                  className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                >
                  <Paperclip className="size-4" />
                </Button>
              </PromptInputAction>

              <PromptInputAction tooltip="Select model">
                <Popover open={modelOpen} onOpenChange={handleModelOpenChange}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      data-testid="model-selector-trigger"
                      disabled={
                        !hasActiveThread ||
                        isSwitchingModel ||
                        providerSnapshots.length === 0
                      }
                      className={cn(
                        "flex items-center gap-[var(--space-1)] rounded-md border border-[var(--color-border-default)] px-[var(--space-2)] py-[var(--space-1.5)] text-xs text-[var(--color-text-tertiary)]",
                        "transition-all duration-[var(--duration-fast)]",
                        "hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
                        "disabled:opacity-50",
                      )}
                    >
                      <span className="max-w-[140px] truncate">
                        {currentModelDisplay}
                      </span>
                      <CaretDown
                        className={cn(
                          "size-3 transition-transform duration-[var(--duration-fast)] ease-out",
                          modelOpen && "rotate-180",
                        )}
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    side="top"
                    sideOffset={8}
                    className="w-60 p-0 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg shadow-lg"
                  >
                    <div className="max-h-48 overflow-y-auto">
                      {providerSnapshots.map((provider) => (
                        <div key={provider.id} className="py-[var(--space-1)]">
                          <div className="border-b border-[var(--color-border-subtle)] px-[var(--space-2)] py-[var(--space-1)] text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                            {provider.name}
                          </div>
                          {provider.models.map((model) => {
                            const value = `${provider.id}::${model.id}`;
                            const isSelected = value === currentModelValue;

                            return (
                              <button
                                key={`${provider.id}:${model.id}`}
                                type="button"
                                data-testid={`model-option-${provider.id}-${model.id}`}
                                onClick={() => handleModelSelect(value)}
                                className={cn(
                                  "w-full px-[var(--space-2)] py-[var(--space-1.5)] text-left text-xs transition-colors duration-[var(--duration-fast)]",
                                  isSelected
                                    ? "bg-[var(--color-accent)] text-[var(--color-text-inverse)]"
                                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
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
            </div>

            <div className="flex items-center gap-[var(--space-3)]">
              {isSwitchingModel ? <Loader label="Switching" /> : null}
              {currentContextWindow != null ? (
                <div className="flex items-center gap-[var(--space-1)] text-xs text-[var(--color-text-tertiary)]">
                  <Brain className="size-3.5" />
                  <span className="tabular-nums">
                    {getContextPercentage(currentContextWindow)}%
                  </span>
                </div>
              ) : null}
              <PromptInputAction tooltip={isPromptExecuting ? "Stop" : "Send"}>
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
                    "h-8 px-[var(--space-4)] text-xs font-medium rounded-full",
                    !isPromptExecuting && !canSend && "opacity-30",
                    isPromptExecuting &&
                      "bg-[var(--color-error)] hover:bg-[var(--color-error)]/90",
                  )}
                >
                  {isPromptExecuting ? (
                    <Square className="mr-[var(--space-1.5)] size-3 fill-current" />
                  ) : null}
                  {isPromptExecuting ? "Stop" : "Send"}
                </Button>
              </PromptInputAction>
            </div>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
