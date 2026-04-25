import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  MentionSuggestion,
  ProviderSnapshot,
  SlashSuggestion,
} from "@pi-desktop/shared";
import * as React from "react";
import type {
  ContextSurfaceKey,
  ContextWindow,
} from "@/features/workspace/workspace-pane-state";
import { DEFAULT_UNTITLED_THREAD_TITLE } from "../../../../../thread-title-defaults";
import { CenterFileViewer } from "./center-file-viewer";
import { ChatThreadPanel } from "./chat-thread-panel";
import { PromptDock, type PromptMode } from "./prompt-dock";
import { TitleBar } from "./title-bar";

export interface WorkspaceShellMainPaneProps {
  platform: string | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  activeThreadTitle: string | null;
  hasActiveThread: boolean;
  hasChangesToCommit: boolean;
  hasCommitsToPush: boolean;
  isPromptExecuting: boolean;
  isTerminalVisible: boolean;
  draft: string;
  canSend: boolean;
  autocompleteSuggestions: (SlashSuggestion | MentionSuggestion)[];
  autocompleteSelectedIndex: number;
  displayAgentStatus: string;
  runtimeModeLabel: string;
  providerSnapshots: ProviderSnapshot[];
  currentModelValue: string;
  contextUsage: AgentSnapshot["contextUsage"];
  isSwitchingModel: boolean;
  isPromptVisible: boolean;
  promptMode: PromptMode;
  threadMessages: AgentMessageSnapshot[];
  threadLastError: string | null;
  contextWindows: ContextWindow[];
  selectedContextSurface: ContextSurfaceKey | null;
  selectedFileWindow: Extract<ContextWindow, { kind: "file" }> | null;
  targetMessageId: string | null;
  onTargetMessageNavigated: (messageId: string) => void;
  onToggleTerminal: () => void;
  onSelectContextSurface: (surfaceKey: ContextSurfaceKey | null) => void;
  onCloseFileWindow: (windowId: string) => void;
  onFileContentChange: (windowId: string, content: string) => void;
  onFileSave: (windowId: string, filePath: string) => void | Promise<void>;
  onDraftChange: (draft: string) => void;
  onSend: () => void | Promise<void>;
  onCancelPrompt: () => void | Promise<void>;
  onAutocompleteSelect: (
    suggestion: SlashSuggestion | MentionSuggestion,
  ) => void;
  onAutocompleteHover: (index: number) => void;
  onPromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onModelMenuOpenChange: (open: boolean) => void | Promise<void>;
  onModelSelection: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void | Promise<void>;
  onPromptModeChange: (mode: PromptMode) => void;
  onConnectProvider?: () => void;
  favoriteModels?: string[];
  onToggleFavorite?: (modelValue: string) => void;
  onAgentGitAction?: (prompt: string) => void;
}

function WorkspaceShellMainPaneImpl({
  platform,
  activeWorktreeId,
  activeThreadId,
  activeThreadTitle,
  hasActiveThread,
  hasChangesToCommit,
  hasCommitsToPush,
  isPromptExecuting,
  isTerminalVisible,
  draft,
  canSend,
  autocompleteSuggestions,
  autocompleteSelectedIndex,
  displayAgentStatus,
  runtimeModeLabel,
  providerSnapshots,
  currentModelValue,
  contextUsage,
  isSwitchingModel,
  isPromptVisible,
  promptMode,
  threadMessages,
  threadLastError,
  contextWindows,
  selectedContextSurface,
  selectedFileWindow,
  targetMessageId,
  onTargetMessageNavigated,
  onToggleTerminal,
  onSelectContextSurface,
  onCloseFileWindow,
  onFileContentChange,
  onFileSave,
  onDraftChange,
  onSend,
  onCancelPrompt,
  onAutocompleteSelect,
  onAutocompleteHover,
  onPromptKeyDown,
  onModelMenuOpenChange,
  onModelSelection,
  onPromptModeChange,
  onConnectProvider,
  favoriteModels,
  onToggleFavorite,
  onAgentGitAction,
}: WorkspaceShellMainPaneProps) {
  return (
    <>
      <TitleBar
        platform={platform}
        onAgentGitAction={onAgentGitAction}
        hasActiveThread={hasActiveThread}
        hasChangesToCommit={hasChangesToCommit}
        hasCommitsToPush={hasCommitsToPush}
        isPromptExecuting={isPromptExecuting}
        onToggleTerminal={onToggleTerminal}
        isTerminalVisible={isTerminalVisible}
        activeThreadId={activeThreadId}
        activeThreadTitle={activeThreadTitle}
        contextWindows={contextWindows}
        selectedContextSurface={selectedContextSurface}
        onSelectContextSurface={onSelectContextSurface}
        onCloseFileWindow={onCloseFileWindow}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden select-none">
        <div
          data-testid="workspace-chat-panel"
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden select-none"
        >
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {selectedFileWindow ? (
              <CenterFileViewer
                activeWorktreeId={activeWorktreeId}
                windowId={selectedFileWindow.id}
                filePath={selectedFileWindow.filePath}
                isDirty={selectedFileWindow.isDirty}
                isReadOnly={selectedFileWindow.isReadOnly}
                onContentChange={onFileContentChange}
                onFileSave={onFileSave}
              />
            ) : hasActiveThread ? (
              <div
                key={activeThreadId ?? "thread"}
                className="tab-content-enter h-full"
              >
                <ChatThreadPanel
                  threadTitle={
                    activeThreadTitle ?? DEFAULT_UNTITLED_THREAD_TITLE
                  }
                  messages={threadMessages}
                  isStreaming={isPromptExecuting}
                  lastError={threadLastError}
                  targetMessageId={targetMessageId}
                  onTargetMessageNavigated={onTargetMessageNavigated}
                  className="h-full"
                />
              </div>
            ) : null}
          </div>

          <div className="shrink-0">
            {selectedFileWindow === null ? (
              <PromptDock
                draft={draft}
                onDraftChange={onDraftChange}
                onSend={onSend}
                onCancelPrompt={onCancelPrompt}
                activeThreadId={activeThreadId}
                canSend={canSend}
                isVisible={isPromptVisible}
                isPromptExecuting={isPromptExecuting}
                autocompleteSuggestions={autocompleteSuggestions}
                autocompleteSelectedIndex={autocompleteSelectedIndex}
                onAutocompleteSelect={onAutocompleteSelect}
                onAutocompleteHover={onAutocompleteHover}
                onPromptKeyDown={onPromptKeyDown}
                displayAgentStatus={displayAgentStatus}
                runtimeModeLabel={runtimeModeLabel}
                providerSnapshots={providerSnapshots}
                currentModelValue={currentModelValue}
                contextUsage={contextUsage}
                isSwitchingModel={isSwitchingModel}
                promptMode={promptMode}
                onPromptModeChange={onPromptModeChange}
                onModelMenuOpenChange={onModelMenuOpenChange}
                onModelSelection={onModelSelection}
                onConnectProvider={onConnectProvider}
                favoriteModels={favoriteModels}
                onToggleFavorite={onToggleFavorite}
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

export const WorkspaceShellMainPane = React.memo(WorkspaceShellMainPaneImpl);
