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
import {
  ArrowUp,
  CaretDown,
  Cpu,
  ICON_SIZE_MD,
  ICON_SIZE_SM,
  ICON_SIZE_XS,
  Microphone,
  Paperclip,
  Square,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { buildFileMention } from "../../lib/prompt-routing";
import { Button } from "../ui/button";
import { FileUpload, type UploadedFile } from "../ui/file-upload";
import { Image } from "../ui/image";
import { Loader } from "../ui/loader";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import PromptAutocomplete from "../ui/prompt-autocomplete";

function _formatTokenCount(tokens: number): string {
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
  displayAgentStatus: string;
  runtimeModeLabel: string;
  providerSnapshots: ProviderSnapshot[];
  currentModelValue: string;
  isSwitchingModel: boolean;
  promptMode?: PromptMode;
  onPromptModeChange?: (mode: PromptMode) => void;
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
  promptMode = "build",
  onPromptModeChange,
  onModelMenuOpenChange,
  onModelSelection,
}: PromptDockProps) {
  const modelSelectRef = React.useRef<HTMLSelectElement | null>(null);
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

  const handleModelSelect = React.useCallback((value: string) => {
    if (modelSelectRef.current) {
      modelSelectRef.current.value = value;
      modelSelectRef.current.dispatchEvent(
        new Event("change", { bubbles: true }),
      );
    }
    setModelOpen(false);
  }, []);

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
        "relative w-full overflow-visible border-t border-white/[0.08] bg-[var(--color-bg-primary)] select-none",
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
        <select
          ref={modelSelectRef}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => void onModelSelection(e)}
        >
          {providerSnapshots.flatMap((p) =>
            p.models.map((m) => (
              <option key={`${p.id}::${m.id}`} value={`${p.id}::${m.id}`}>
                {m.name}
              </option>
            )),
          )}
        </select>
        <PromptInput
          value={draft}
          onValueChange={onDraftChange}
          onSubmit={() =>
            void (isPromptExecuting ? onCancelPrompt() : onSend())
          }
          className={cn("px-6 pb-4 pt-4")}
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
                ? "Ask Pi to inspect, plan, fix, or ship…"
                : "Select a thread to start typing…"
            }
            disabled={!hasActiveThread}
            onKeyDown={onPromptKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              "min-h-[36px] resize-none border-0 bg-transparent px-0 py-0",
              "text-[13px] leading-5 text-[var(--color-text-primary)]",
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
            className="absolute bottom-full left-0 right-0 z-20 mb-2"
          />

          <PromptInputActions className="mt-3 flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
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
                  <Paperclip className={ICON_SIZE_MD} />
                </Button>
              </PromptInputAction>

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
                      "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/60",
                      "transition-all duration-[var(--duration-fast)]",
                      "hover:text-white/90 hover:bg-white/[0.04]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
                      "disabled:opacity-50",
                    )}
                  >
                    <span className="max-w-[140px] truncate text-[11px]">
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
                  className="w-64 rounded-lg border border-white/[0.06] bg-[#111111] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                >
                  <div className="max-h-72 overflow-y-auto">
                    {providerSnapshots.map((provider) => (
                      <div key={provider.id}>
                        <div className="px-2 py-1.5 text-[11px] text-white/40">
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
                                "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] transition-colors",
                                isSelected
                                  ? "bg-white/[0.08] text-white"
                                  : "text-white/70 hover:bg-white/[0.04] hover:text-white",
                              )}
                            >
                              <span>{model.name}</span>
                              {isSelected && (
                                <svg
                                  className="size-4 text-white/60"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                  aria-hidden="true"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-[var(--space-3)]">
              {isSwitchingModel ? <Loader label="Switching" /> : null}
              {currentContextWindow != null ? (
                <PromptInputAction
                  tooltip={
                    <div className="flex flex-col gap-1 px-1 py-0.5">
                      <div className="text-[11px] font-medium text-white">
                        {currentModelDisplay}
                      </div>
                      <div className="text-[10px] text-white/50">
                        Context: {_formatTokenCount(currentContextWindow)} tokens
                      </div>
                    </div>
                  }
                >
                  <div className="flex items-center gap-1.5 cursor-default">
                    <div className="relative flex items-center justify-center size-3.5">
                      <svg
                        className="size-full -rotate-90 transform"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          fill="transparent"
                          className="text-white/10"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 10}
                          strokeDashoffset={
                            2 * Math.PI * 10 *
                            (1 - getContextPercentage(currentContextWindow) / 100)
                          }
                          strokeLinecap="round"
                          className="text-[var(--color-text-tertiary)] transition-all duration-500 ease-in-out"
                        />
                      </svg>
                    </div>
                    <span className="tabular-nums text-[11px] font-medium text-[var(--color-text-tertiary)]">
                      {getContextPercentage(currentContextWindow)}%
                    </span>
                  </div>
                </PromptInputAction>
              ) : null}

              {/* Item 15: Circular ArrowUp send button */}
              <PromptInputAction tooltip={isPromptExecuting ? "Stop" : "Send"}>
                <Button
                  type="button"
                  data-testid="chat-send"
                  variant={isPromptExecuting ? "destructive" : "default"}
                  size="icon"
                  disabled={isPromptExecuting ? false : !canSend}
                  onClick={() =>
                    void (isPromptExecuting ? onCancelPrompt() : onSend())
                  }
                  className={cn(
                    "size-7 rounded-full p-0",
                    !isPromptExecuting &&
                      "bg-white/80 text-black hover:bg-white",
                    !isPromptExecuting && !canSend && "opacity-20",
                    isPromptExecuting &&
                      "bg-[var(--color-error)] hover:bg-[var(--color-error)]/90",
                  )}
                >
                  {isPromptExecuting ? (
                    <Square className={`${ICON_SIZE_XS} fill-current`} />
                  ) : (
                    <ArrowUp className="size-4" weight="bold" />
                  )}
                </Button>
              </PromptInputAction>
            </div>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
