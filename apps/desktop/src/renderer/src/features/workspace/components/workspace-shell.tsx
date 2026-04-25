import type {
  GitRepositoryStatus,
  MentionSuggestion,
  ProviderSnapshot,
  RepositorySnapshot,
  ShellGitSnapshot,
  SlashSuggestion,
} from "@pi-desktop/shared";
import * as React from "react";
import type {
  ContextSurfaceKey,
  ContextWindow,
} from "@/features/workspace/workspace-pane-state";
import { FileTreePanel } from "./file-tree-panel";
import { GitPanel } from "./git-panel";
import { SIDEBAR_WIDTH } from "./left-sidebar";
import { buildWorkspaceShellDerivedState } from "./workspace-shell-derived-state";
import { useWorkspaceShellEvents } from "./workspace-shell-events";
import { useWorkspaceShellFullscreen } from "./workspace-shell-fullscreen";
import { WorkspaceShellLayout } from "./workspace-shell-layout";
import { buildWorkspaceShellLayoutProps } from "./workspace-shell-layout-props";
import { useWorkspaceShellTargetMessage } from "./workspace-shell-target-message";

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
  appVersion?: string;
  gitCommitMessage: string;
  threadMessages: import("@pi-desktop/shared").AgentMessageSnapshot[];
  threadLastError: string | null;
  contextWindows: ContextWindow[];
  selectedContextSurface: ContextSurfaceKey | null;
  leftSidebarWidth: number;
  onSelectContextSurface: (surfaceKey: ContextSurfaceKey | null) => void;
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
  onArchiveWorktree?: (worktreeId: string) => void;
  onArchiveThread?: (threadId: string) => void;
  onOpenGit: () => void;
  onToggleTerminal: () => void;
  isTerminalVisible: boolean;
  onTerminalCommandComplete: () => void;
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
  onSelectContextSurface,
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
  onCreateThread: _onCreateThread,
  onDeleteWorktree,
  onCloseThread: _onCloseThread,
  onDeleteThread,
  onArchiveWorktree,
  onArchiveThread,
  onOpenGit: _onOpenGit,
  onToggleTerminal,
  isTerminalVisible,
  onTerminalCommandComplete,
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
  useWorkspaceShellFullscreen();
  const { targetMessageId, setTargetMessageId, handleTargetMessageNavigated } =
    useWorkspaceShellTargetMessage();

  const lastExpandedSidebarWidthRef = React.useRef(
    leftSidebarWidth > 0 ? leftSidebarWidth : SIDEBAR_WIDTH,
  );

  const handleToggleSidebar = React.useCallback(() => {
    if (leftSidebarWidth > 0) {
      onLeftSidebarResize(0);
      return;
    }

    onLeftSidebarResize(lastExpandedSidebarWidthRef.current || SIDEBAR_WIDTH);
  }, [leftSidebarWidth, onLeftSidebarResize]);

  useWorkspaceShellEvents({
    activeWorktreeId,
    onCreateThread: _onCreateThread,
    onToggleSidebar: handleToggleSidebar,
    onSelectThread,
    onTargetMessage: setTargetMessageId,
  });

  React.useEffect(() => {
    if (leftSidebarWidth > 0) {
      lastExpandedSidebarWidthRef.current = leftSidebarWidth;
    }
  }, [leftSidebarWidth]);

  const {
    projectName,
    activeWorktree,
    hasActiveThread,
    hasChangesToCommit,
    hasCommitsToPush,
    selectedFileWindow,
  } = React.useMemo(
    () =>
      buildWorkspaceShellDerivedState({
        activeRepository,
        activeWorktreeId,
        activeThreadId,
        activeGitRepositoryStatus,
        shellGit,
        contextWindows,
        selectedContextSurface,
      }),
    [
      activeRepository,
      activeWorktreeId,
      activeThreadId,
      activeGitRepositoryStatus,
      shellGit,
      contextWindows,
      selectedContextSurface,
    ],
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

  const layoutProps = buildWorkspaceShellLayoutProps({
    platform,
    appVersion,
    repositories,
    activeRepositoryId,
    activeWorktreeId,
    activeThreadId,
    isPromptExecuting,
    threadLastViewedAt,
    leftSidebarWidth,
    onLeftSidebarResize,
    onSelectRepository,
    onRemoveRepository,
    onCopyRepositoryPath,
    onOpenInFinder,
    onCreateSession,
    onSelectWorktree,
    onSelectThread,
    onDeleteWorktree,
    onDeleteThread,
    onArchiveWorktree,
    onArchiveThread,
    onCreateThread: _onCreateThread,
    onAddRepository,
    gitPanel,
    filesPanel,
    activeThreadTitle,
    hasActiveThread,
    hasChangesToCommit,
    hasCommitsToPush,
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
    onTargetMessageNavigated: handleTargetMessageNavigated,
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
    workspacePath,
    onTerminalCommandComplete,
    activeGitRepositoryStatus,
    shellGit,
  });

  return <WorkspaceShellLayout {...layoutProps} />;
}

export const WorkspaceShell = React.memo(WorkspaceShellImpl);
