import type {
  GitRepositoryStatus,
  MentionSuggestion,
  ProviderSnapshot,
  RepositorySnapshot,
  ShellGitSnapshot,
  SlashSuggestion,
} from "@pi-desktop/shared";
import * as React from "react";

import { SidebarSimple, TerminalWindow, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Terminal } from "../ui/terminal";
import { DEFAULT_UNTITLED_THREAD_TITLE } from "../../../../thread-title-defaults";
import {
  type ContextSurfaceKey,
  type ContextWindow,
  getMainPaneState,
} from "../../lib/workspace-pane-state";
import { uiInteractionStore } from "../../stores/ui-interaction-store";
import { CenterFileViewer } from "./center-file-viewer";
import { ChatThreadPanel } from "./chat-thread-panel";
import { FileTreePanel } from "./file-tree-panel";
import { GitPanel } from "./git-panel";
import { LeftSidebar, SIDEBAR_WIDTH } from "./left-sidebar";
import { PromptDock } from "./prompt-dock";
import { ThreadTabs } from "./thread-tabs";
import { TitleBar } from "./title-bar";

export interface WorkspaceShellProps {
  platform: string | null;
  repositories: RepositorySnapshot[];
  activeRepository: RepositorySnapshot | null;
  activeRepositoryId: string | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  activeThreadTitle: string | null;
  draft: string;
  canSend: boolean;
  autocompleteSuggestions: (SlashSuggestion | MentionSuggestion)[];
  autocompleteSelectedIndex: number;
  displayAgentStatus: string;
  runtimeModeLabel: string;
  providerSnapshots: ProviderSnapshot[];
  currentModelValue: string;
  contextUsage: import("@pi-desktop/shared").AgentSnapshot["contextUsage"];
  isSwitchingModel: boolean;
  isPromptVisible: boolean;
  isPromptExecuting: boolean;
  activeGitRepositoryStatus: GitRepositoryStatus | null;
  shellGit: ShellGitSnapshot | null;
  gitCommitMessage: string;
  threadMessages: import("@pi-desktop/shared").AgentMessageSnapshot[];
  threadLastError: string | null;
  contextWindows: ContextWindow[];
  selectedContextSurface: ContextSurfaceKey | null;
  leftSidebarWidth: number;
  onSelectContextSurface: (surfaceKey: ContextSurfaceKey) => void;
  onCloseFileWindow: (windowId: string) => void;
  onLeftSidebarResize: (width: number) => void;
  onModelMenuOpenChange: (open: boolean) => void | Promise<void>;
  onAddRepository: () => void | Promise<void>;
  onSelectRepository: (repositoryId: string) => void | Promise<void>;
  onRemoveRepository: (repositoryId: string) => void | Promise<void>;
  onCopyRepositoryPath: (repositoryId: string) => void | Promise<void>;
  onOpenInFinder: (repositoryId: string) => void | Promise<void>;
  onCreateSession: () => void | Promise<void>;
  onSelectWorktree: (worktreeId: string) => void | Promise<void>;
  onSelectThread: (threadId: string) => void | Promise<void>;
  onCreateThread: (worktreeId: string) => string | Promise<string>;
  onDeleteWorktree?: (worktreeId: string) => void | Promise<void>;
  onCloseThread: (threadId: string) => void | Promise<void>;
  onDeleteThread?: (threadId: string) => void | Promise<void>;
  onOpenGit: () => void;
  onToggleTerminal: () => void;
  isTerminalVisible: boolean;
  onGitCommitMessageChange: (value: string) => void;
  onRefreshGit: () => void | Promise<void>;
  onCommitGit: () => void | Promise<void>;
  onCommitAndPushGit: () => void | Promise<void>;
  onPullGit: () => void | Promise<void>;
  onPushGit: () => void | Promise<void>;
  onFetchGit: () => void | Promise<void>;
  onStageGitFile: (filePath: string) => void | Promise<void>;
  onStageAllGitFiles: (filePaths: string[]) => void | Promise<void>;
  onUnstageGitFile: (filePath: string) => void | Promise<void>;
  onUnstageAllGitFiles: (filePaths: string[]) => void | Promise<void>;
  onDiscardGitFile: (filePath: string) => void | Promise<void>;
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
  onModelSelection: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void | Promise<void>;
  promptMode: "build" | "plan";
  onPromptModeChange: (mode: "build" | "plan") => void;
  workspacePath: string | null;
  onFileTreeFileSelect: (path: string) => void;
  onFileTreeDeleteFile: (path: string) => void | Promise<void>;
  onFileTreeRenameFile: (
    oldPath: string,
    newPath: string,
  ) => void | Promise<void>;
  onFileTreeMoveFile: (
    source: string,
    destination: string,
  ) => void | Promise<void>;
  onConnectProvider?: () => void;
  favoriteModels?: string[];
  onToggleFavorite?: (modelValue: string) => void;
  onAgentGitAction?: (prompt: string) => void;
}

function WorkspaceShellImpl({
  platform,
  repositories,
  activeRepository,
  activeRepositoryId,
  activeWorktreeId,
  activeThreadId,
  activeThreadTitle,
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
  isPromptExecuting,
  activeGitRepositoryStatus,
  shellGit,
  gitCommitMessage,
  threadMessages,
  threadLastError,
  contextWindows,
  selectedContextSurface,
  leftSidebarWidth,
  onSelectContextSurface: _onSelectContextSurface,
  onCloseFileWindow,
  onLeftSidebarResize,
  onModelMenuOpenChange,
  onAddRepository,
  onSelectRepository,
  onRemoveRepository,
  onCopyRepositoryPath,
  onOpenInFinder,
  onCreateSession,
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
  onDeleteWorktree,
  onCloseThread,
  onDeleteThread,
  onOpenGit: _onOpenGit,
  onToggleTerminal,
  isTerminalVisible,
  onGitCommitMessageChange,
  onRefreshGit,
  onCommitGit,
  onCommitAndPushGit,
  onPullGit,
  onPushGit,
  onFetchGit,
  onStageGitFile,
  onStageAllGitFiles,
  onUnstageGitFile,
  onUnstageAllGitFiles,
  onDiscardGitFile,
  onFileContentChange,
  onFileSave,
  onDraftChange,
  onSend,
  onCancelPrompt,
  onAutocompleteSelect,
  onAutocompleteHover,
  onPromptKeyDown,
  onModelSelection,
  promptMode,
  onPromptModeChange,
  onConnectProvider,
  favoriteModels,
  onToggleFavorite,
  workspacePath,
  onFileTreeFileSelect,
  onFileTreeDeleteFile,
  onFileTreeRenameFile,
  onFileTreeMoveFile,
  onAgentGitAction,
}: WorkspaceShellProps) {
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = React.useState(true);
  const collapseTimestampRef = React.useRef(0);

  React.useEffect(() => {
    let disposed = false;
    const interactions = uiInteractionStore.getState();

    void window.piDesktop.window.getFullscreenState().then((isFullscreen) => {
      if (!disposed) {
        interactions.setMainWindowFullscreen(isFullscreen);
      }
    });

    const unsubscribe = window.piDesktop.window.onFullscreenChanged(
      (isFullscreen) => {
        uiInteractionStore.getState().setMainWindowFullscreen(isFullscreen);
      },
    );

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const projectName =
    activeRepository?.customName ?? activeRepository?.name ?? "Pi";
  const activeWorktree =
    activeRepository?.worktrees.find(
      (worktree) => worktree.id === activeWorktreeId,
    ) ?? null;

  const hasActiveThread = activeThreadId !== null;
  const leftSidebarTargetWidth = Math.max(leftSidebarWidth, SIDEBAR_WIDTH);
  const mainPaneState = React.useMemo(
    () =>
      getMainPaneState({
        contextWindows,
        selectedContextSurface,
      }),
    [contextWindows, selectedContextSurface],
  );
  const openFileWindows = React.useMemo(
    () =>
      contextWindows.filter(
        (window): window is Extract<ContextWindow, { kind: "file" }> =>
          window.kind === "file",
      ),
    [contextWindows],
  );
  const selectedFileWindow = React.useMemo(
    () =>
      mainPaneState.selectedFileWindowId === null
        ? null
        : (openFileWindows.find(
            (window) => window.id === mainPaneState.selectedFileWindowId,
          ) ?? null),
    [mainPaneState.selectedFileWindowId, openFileWindows],
  );

  const gitPanel = (
    <GitPanel
      projectName={projectName}
      repositoryPath={
        activeWorktree?.path ?? activeRepository?.rootPath ?? null
      }
      worktree={activeWorktree}
      repositoryStatus={activeGitRepositoryStatus}
      shellGit={shellGit}
      commitMessage={gitCommitMessage}
      onCommitMessageChange={onGitCommitMessageChange}
      onRefresh={onRefreshGit}
      onCommit={onCommitGit}
      onCommitAndPush={onCommitAndPushGit}
      onPull={onPullGit}
      onPush={onPushGit}
      onFetch={onFetchGit}
      onStageFile={onStageGitFile}
      onStageAllFiles={onStageAllGitFiles}
      onUnstageFile={onUnstageGitFile}
      onUnstageAllFiles={onUnstageAllGitFiles}
      onDiscardFile={onDiscardGitFile}
    />
  );

  const filesPanel = (
    <FileTreePanel
      workspacePath={workspacePath}
      onFileSelect={onFileTreeFileSelect}
      onDeleteFile={onFileTreeDeleteFile}
      onRenameFile={onFileTreeRenameFile}
      onMoveFile={onFileTreeMoveFile}
      repositoryStatus={activeGitRepositoryStatus}
    />
  );

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden select-none">
      <div className="relative flex min-h-0 flex-1 select-none">
        {!isLeftSidebarVisible && (
          <div
            aria-hidden="true"
            data-no-drag="true"
            onMouseEnter={() => {
              if (Date.now() - collapseTimestampRef.current > 400) {
                setIsLeftSidebarVisible(true);
              }
            }}
            className="absolute inset-y-0 left-0 z-30 w-2"
          />
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-no-drag="true"
              onClick={() => {
                if (isLeftSidebarVisible) {
                  collapseTimestampRef.current = Date.now();
                  setIsLeftSidebarVisible(false);
                } else {
                  setIsLeftSidebarVisible(true);
                }
              }}
              className={cn(
                "absolute z-30 flex size-8 items-center justify-center text-white/30 transition-all duration-150 hover:bg-white/[0.04] hover:text-white/60",
                isLeftSidebarVisible ? "left-1" : "left-2",
              )}
              style={{ top: "calc(var(--titlebar-height) + 44px)" }}
            >
              <SidebarSimple className="size-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isLeftSidebarVisible ? "Hide sidebar" : "Show sidebar"}
          </TooltipContent>
        </Tooltip>

        <div
          data-left-sidebar-wrapper="true"
          className={cn(
            "min-h-0 shrink-0 overflow-hidden",
            "will-change-[width,transform]",
            "transition-[width,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
            isLeftSidebarVisible
              ? "opacity-100"
              : "pointer-events-none opacity-0",
          )}
          style={{ width: isLeftSidebarVisible ? leftSidebarTargetWidth : 0 }}
        >
          <div
            data-left-sidebar-inner="true"
            className={cn(
              "h-full will-change-transform",
              isLeftSidebarVisible
                ? "translate-x-0 opacity-100 transition-[transform,opacity] duration-[var(--duration-enter)] ease-[var(--ease-emphasized-decel)]"
                : "-translate-x-2 opacity-0 transition-[transform,opacity] duration-[var(--duration-exit)] ease-[var(--ease-emphasized-accel)]",
            )}
            style={{ width: leftSidebarTargetWidth }}
          >
            <LeftSidebar
              repositories={repositories}
              activeRepositoryId={activeRepositoryId}
              activeWorktreeId={activeWorktreeId}
              activeThreadId={activeThreadId}
              isPromptExecuting={isPromptExecuting}
              width={leftSidebarTargetWidth}
              onResize={onLeftSidebarResize}
              onSelectRepository={onSelectRepository}
              onRemoveRepository={onRemoveRepository}
              onCopyRepositoryPath={onCopyRepositoryPath}
              onOpenInFinder={onOpenInFinder}
              onCreateSession={onCreateSession}
              onSelectWorktree={onSelectWorktree}
              onSelectThread={onSelectThread}
              onDeleteWorktree={onDeleteWorktree}
              onDeleteThread={onDeleteThread}
              onAddRepository={onAddRepository}
              gitPanel={gitPanel}
              filesPanel={filesPanel}
            />
          </div>
        </div>

        <main
          data-testid="chat-first-layout"
          className={cn(
            "relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden",
            "bg-[var(--shell-main-bg)]",
          )}
        >
          <TitleBar
            platform={platform}
            onAgentGitAction={onAgentGitAction}
            hasActiveThread={hasActiveThread}
            onToggleTerminal={onToggleTerminal}
            isTerminalVisible={isTerminalVisible}
          />
          <div className="flex min-h-0 flex-1 overflow-hidden select-none">
            <div
              data-testid="workspace-chat-panel"
              className={cn(
                "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden select-none",
              )}
            >
              {activeWorktree ? (
                <ThreadTabs
                  threads={activeWorktree.threads}
                  fileTabs={openFileWindows}
                  activeThreadId={activeThreadId}
                  activeFileId={mainPaneState.selectedFileWindowId}
                  onSelectThread={(threadId) => {
                    void onSelectThread(threadId);
                  }}
                  onCloseThread={(threadId) => {
                    void onCloseThread(threadId);
                  }}
                  onSelectFile={(windowId) => {
                    _onSelectContextSurface(windowId);
                  }}
                  onCloseFile={(windowId) => {
                    onCloseFileWindow(windowId);
                  }}
                  onCreateThread={() => {
                    if (!activeWorktreeId) {
                      return;
                    }
                    void onCreateThread(activeWorktreeId);
                  }}
                />
              ) : null}
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
        </main>

        {isTerminalVisible && (
          <aside
            className={cn(
              "flex h-full w-[420px] shrink-0 flex-col border-l border-white/[0.06] bg-[var(--color-bg-primary)]",
              "animate-in slide-in-from-right duration-[var(--duration-normal)] [transition-timing-function:var(--ease-emphasized-decel)]",
            )}
          >
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-3">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
                Terminal
              </span>
              <button
                type="button"
                onClick={onToggleTerminal}
                className="flex size-6 items-center justify-center text-white/30 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/70"
                aria-label="Close terminal"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Terminal
                id="sidebar-terminal"
                cwd={workspacePath ?? undefined}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export const WorkspaceShell = React.memo(WorkspaceShellImpl);
