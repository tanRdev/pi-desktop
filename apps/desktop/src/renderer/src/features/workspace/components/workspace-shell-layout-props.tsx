import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  GitRepositoryStatus,
  MentionSuggestion,
  ProviderSnapshot,
  RepositorySnapshot,
  ShellGitSnapshot,
  SlashSuggestion,
} from "@pi-desktop/shared";
import type * as React from "react";
import type {
  ContextSurfaceKey,
  ContextWindow,
} from "@/features/workspace/workspace-pane-state";
import type { LeftSidebarProps } from "./left-sidebar";
import type { StatusBarProps } from "./status-bar";
import type { WorkspaceShellLayoutProps } from "./workspace-shell-layout";
import type { WorkspaceShellMainPaneProps } from "./workspace-shell-main-pane";
import type { WorkspaceShellTerminalAsideProps } from "./workspace-shell-terminal-aside";

interface BuildWorkspaceShellLayoutPropsParams {
  platform: string | null;
  appVersion?: string;
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  isPromptExecuting: boolean;
  threadLastViewedAt: Record<string, number>;
  leftSidebarWidth: number;
  onLeftSidebarResize: (width: number) => void;
  onSelectRepository: (repositoryId: string) => void | Promise<void>;
  onRemoveRepository: (repositoryId: string) => void | Promise<void>;
  onCopyRepositoryPath: (repositoryId: string) => void | Promise<void>;
  onOpenInFinder: (repositoryId: string) => void | Promise<void>;
  onCreateSession: () => void | Promise<void>;
  onSelectWorktree: (worktreeId: string) => void | Promise<void>;
  onSelectThread: (threadId: string) => void | Promise<void>;
  onDeleteWorktree?: (worktreeId: string) => void | Promise<void>;
  onDeleteThread?: (threadId: string) => void | Promise<void>;
  onArchiveWorktree?: (worktreeId: string) => void;
  onArchiveThread?: (threadId: string) => void;
  onCreateThread: (worktreeId: string) => string | Promise<string>;
  onAddRepository: () => void | Promise<void>;
  gitPanel: React.ReactNode;
  filesPanel: React.ReactNode;
  activeThreadTitle: string | null;
  hasActiveThread: boolean;
  hasChangesToCommit: boolean;
  hasCommitsToPush: boolean;
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
  promptMode: WorkspaceShellMainPaneProps["promptMode"];
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
  onPromptModeChange: (mode: WorkspaceShellMainPaneProps["promptMode"]) => void;
  onConnectProvider?: () => void;
  favoriteModels?: string[];
  onToggleFavorite?: (modelValue: string) => void;
  onAgentGitAction?: (prompt: string) => void;
  workspacePath: string | null;
  onTerminalCommandComplete: () => void;
  activeGitRepositoryStatus: GitRepositoryStatus | null;
  shellGit: ShellGitSnapshot | null;
}

export function buildWorkspaceShellLayoutProps({
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
  onCreateThread,
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
  workspacePath,
  onTerminalCommandComplete,
  activeGitRepositoryStatus,
  shellGit,
}: BuildWorkspaceShellLayoutPropsParams): WorkspaceShellLayoutProps {
  const leftSidebarProps: LeftSidebarProps = {
    platform,
    appVersion,
    repositories,
    activeRepositoryId,
    activeWorktreeId,
    activeThreadId,
    isPromptExecuting,
    threadLastViewedAt,
    width: leftSidebarWidth,
    onResize: onLeftSidebarResize,
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
    onCreateThread,
    onAddRepository,
    gitPanel,
    filesPanel,
  };

  const mainPaneProps: WorkspaceShellMainPaneProps = {
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
  };

  const terminalAsideProps: WorkspaceShellTerminalAsideProps | null =
    isTerminalVisible
      ? {
          workspacePath,
          onToggleTerminal,
          onTerminalCommandComplete,
        }
      : null;

  const statusBarProps: StatusBarProps = {
    gitStatus: activeGitRepositoryStatus,
    shellGit,
    currentModelValue,
  };

  return {
    leftSidebarProps,
    mainPaneProps,
    terminalAsideProps,
    statusBarProps,
  };
}
