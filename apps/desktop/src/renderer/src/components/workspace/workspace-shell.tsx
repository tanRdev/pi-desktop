import type {
  GitRepositoryStatus,
  MentionSuggestion,
  ProviderSnapshot,
  RepositorySnapshot,
  ShellGitSnapshot,
  SlashSuggestion,
} from "@pi-desktop/shared";
import * as React from "react";

import { X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
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
  threadLastViewedAt: Record<string, number>;
  activeGitRepositoryStatus: GitRepositoryStatus | null;
  shellGit: ShellGitSnapshot | null;
  appVersion: string;
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
  threadLastViewedAt,
  activeGitRepositoryStatus,
  shellGit,
  appVersion,
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
  const hasChangesToCommit =
    (activeGitRepositoryStatus?.stagedChanges.length ?? 0) +
      (activeGitRepositoryStatus?.unstagedChanges.length ?? 0) >
    0;
  const hasCommitsToPush = (shellGit?.ahead ?? 0) > 0;

  const [activeSidebarSection, setActiveSidebarSection] = React.useState<
    "workspaces" | "files"
  >("workspaces");
  const lastExpandedSidebarWidthRef = React.useRef(
    leftSidebarWidth > 0 ? leftSidebarWidth : SIDEBAR_WIDTH,
  );

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

  React.useEffect(() => {
    if (leftSidebarWidth > 0) {
      lastExpandedSidebarWidthRef.current = leftSidebarWidth;
    }
  }, [leftSidebarWidth]);

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

  const selectSidebarSection = React.useCallback(
    (section: "workspaces" | "files") => {
      setActiveSidebarSection(section);

      if (leftSidebarWidth <= 0) {
        onLeftSidebarResize(lastExpandedSidebarWidthRef.current);
      }
    },
    [leftSidebarWidth, onLeftSidebarResize],
  );

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden select-none">
      <div className="relative flex min-h-0 flex-1 select-none">
        <LeftSidebar
          platform={platform}
          appVersion={appVersion}
          repositories={repositories}
          activeRepositoryId={activeRepositoryId}
          activeWorktreeId={activeWorktreeId}
          activeThreadId={activeThreadId}
          activeTabOverride={activeSidebarSection}
          isPromptExecuting={isPromptExecuting}
          threadLastViewedAt={threadLastViewedAt}
          width={leftSidebarWidth}
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
            hasChangesToCommit={hasChangesToCommit}
            hasCommitsToPush={hasCommitsToPush}
            isPromptExecuting={isPromptExecuting}
            onToggleTerminal={onToggleTerminal}
            isTerminalVisible={isTerminalVisible}
            onAddWorkspace={onAddRepository}
          />
          <div className="flex min-h-0 flex-1 overflow-hidden select-none">
            <div
              data-testid="workspace-chat-panel"
              className={cn(
                "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden select-none",
              )}
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
