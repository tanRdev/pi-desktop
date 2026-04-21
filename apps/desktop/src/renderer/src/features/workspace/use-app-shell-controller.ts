import type { ThreadSnapshot } from "@pi-desktop/shared";
import {
  getActiveRepository,
  getActiveThread,
  getActiveWorktree,
} from "@pi-desktop/shared";
import * as React from "react";
import { useStore } from "zustand";
import {
  type AppDialogsController,
  useAppDialogs,
} from "@/app-shell/use-app-dialogs";
import type { WorkspaceShellProps } from "@/features/workspace/components/workspace-shell";
import {
  useWorkspaceGit,
  type WorkspaceGitController,
} from "@/features/workspace/use-workspace-git";
import {
  useWorkspacePrompt,
  type WorkspacePromptController,
} from "@/features/workspace/use-workspace-prompt";
import {
  useWorkspaceTreeActions,
  type WorkspaceTreeActionsController,
} from "@/features/workspace/use-workspace-tree-actions";
import {
  useWorkspaceWindows,
  type WorkspaceWindowsController,
} from "@/features/workspace/use-workspace-windows";
import { useShellModel } from "@/hooks/use-shell-model";
import {
  getWorkspaceSessionStore,
  useWindowStore,
} from "@/hooks/use-window-store";
import { uiInteractionStore } from "@/stores/ui-interaction-store";
import { syncActiveThreadConversation } from "@/stores/workspace-session-runtime";
import { selectThreadConversationByWorktree } from "@/stores/workspace-session-selectors";
import type { ThreadConversationState } from "@/stores/workspace-session-store";
import { DEFAULT_UNTITLED_THREAD_TITLE } from "../../../../thread-title-defaults";
import {
  useWorkspaceShellControls,
  type WorkspaceShellControlsController,
} from "./use-workspace-shell-controls";

export { getMainPaneState } from "@/features/workspace/workspace-pane-state";

function getThreadWindowTitle(
  thread: ThreadSnapshot | null | undefined,
): string {
  const title = thread?.title.trim();
  return title && title.length > 0 ? title : DEFAULT_UNTITLED_THREAD_TITLE;
}

export function shouldPersistThreadConversation(
  conversation: ThreadConversationState,
): boolean {
  return !(
    conversation.status === "starting" &&
    conversation.messages.length === 0 &&
    conversation.lastError === null
  );
}

export function shouldRetryEmptyShellReload(input: {
  repositoryCount: number;
  selection: {
    repositoryId: string | null;
    worktreeId: string | null;
    threadId: string | null;
  };
}): boolean {
  if (input.repositoryCount > 0) {
    return false;
  }

  return (
    input.selection.repositoryId !== null ||
    input.selection.worktreeId !== null ||
    input.selection.threadId !== null
  );
}

export interface AppShellController
  extends AppDialogsController,
    WorkspaceGitController,
    WorkspacePromptController,
    WorkspaceTreeActionsController,
    WorkspaceWindowsController,
    WorkspaceShellControlsController {
  workspaceShellProps: WorkspaceShellProps;
  onAgentGitAction: (prompt: string) => void;
}

export function useAppShellController(): AppShellController {
  const {
    reload,
    sendPrompt,
    cancelPrompt,
    setDraft,
    state,
    providerSnapshots,
    settingsSnapshot,
    isSwitchingModel,
    switchModel,
    appPreferences,
    updateAppPreferences,
  } = useShellModel();
  const { agent, draft, shell } = state;
  const { state: windowState, store: windowStore } = useWindowStore();

  const activeRepository = React.useMemo(
    () => getActiveRepository(shell),
    [shell],
  );
  const activeWorktree = React.useMemo(() => getActiveWorktree(shell), [shell]);
  const activeThread = React.useMemo(() => getActiveThread(shell), [shell]);
  const platform = shell.platform ?? null;
  const repositories = shell.catalog.repositories;
  const activeRepositoryId = activeRepository?.id ?? null;
  const activeWorktreeId = activeWorktree?.id ?? null;
  const activeWorktreePath = activeWorktree?.path ?? null;
  const activeThreadId = activeThread?.id ?? null;
  const appDialogs = useAppDialogs({
    activeRepositoryId,
    reload,
    uiStore: uiInteractionStore,
  });
  const {
    confirmRemoveRepository,
    openOAuthDialog,
    requestInitGitRepo,
    setCreateWorktreeOpen,
  } = appDialogs;
  const workspaceShellControls = useWorkspaceShellControls({
    agentStatus: agent.status,
    runtimeMode: shell.runtime?.agentMode ?? "unknown",
    providerSnapshots,
    settingsSnapshot,
    appPreferences,
    reload,
    switchModel,
    updateAppPreferences,
    openOAuthDialog,
  });
  const {
    displayAgentStatus,
    runtimeModeLabel,
    currentModelValue,
    favoriteModels,
    leftSidebarWidth,
    handleModelSelection,
    handleToggleFavorite,
    handleModelMenuOpenChange,
    handleLeftSidebarResize,
    handleConnectProvider,
  } = workspaceShellControls;
  const workspaceGit = useWorkspaceGit({ activeWorktreePath, reload });
  const {
    activeGitRepositoryStatus,
    gitCommitMessage,
    setGitCommitMessage,
    refreshGitRepositoryStatus,
    stageGitFile,
    stageAllGitFiles,
    unstageGitFile,
    unstageAllGitFiles,
    discardGitFile,
    commitGitChanges,
    commitAndPushGitChanges,
    pullGitChanges,
    pushGitChanges,
    fetchGitChanges,
  } = workspaceGit;
  const workspaceWindows = useWorkspaceWindows({
    activeRepositoryName: activeRepository?.name ?? null,
    activeWorktreeId,
    activeWorktreePath,
    windows: windowState.layout.windows,
    sessionStore: getWorkspaceSessionStore(),
    windowStore,
  });
  const {
    contextWindows,
    selectedContextSurface,
    isTerminalVisible,
    clearSelectedContextSurface,
    handleSelectContextSurface,
    handleCloseFileWindow,
    handleToggleTerminal,
    handleOpenGit,
    handleFileContentChange,
    handleFileSave,
    handleFileTreeFileSelect,
    handleFileTreeDeleteFile,
    handleFileTreeRenameFile,
    handleFileTreeMoveFile,
  } = workspaceWindows;
  const workspaceTreeActions = useWorkspaceTreeActions({
    repositories,
    activeWorktree,
    activeWorktreeId,
    activeThreadId,
    reload,
    clearSelectedContextSurface,
    confirmRemoveRepository,
    requestInitGitRepo,
    setCreateWorktreeOpen,
  });
  const {
    addRepository,
    selectRepository,
    removeRepository,
    copyRepositoryPath,
    openInFinder,
    createSession,
    selectWorktree,
    createThread,
    closeThread,
    deleteThread,
    deleteWorktree,
    selectThread,
  } = workspaceTreeActions;
  const activeThreadConversation = React.useSyncExternalStore(
    getWorkspaceSessionStore().subscribe,
    () =>
      activeThreadId
        ? selectThreadConversationByWorktree(
            getWorkspaceSessionStore().getState(),
            activeWorktreeId,
            activeThreadId,
          )
        : undefined,
    () => undefined,
  );
  const threadLastViewedAt = useStore(
    uiInteractionStore,
    (storeState) => storeState.threadLastViewedAt,
  );
  const workspacePrompt = useWorkspacePrompt({
    draft,
    setDraft,
    sendPrompt,
    cancelPrompt,
    activeThreadId,
    activeThreadConversation,
    agentStatus: agent.status,
    activeWorktreePath,
    contextWindows,
    uiStore: uiInteractionStore,
    openOAuthDialog,
  });
  const {
    autocompleteSuggestions,
    autocompleteSelectedIndex,
    canSend,
    isPromptExecuting,
    isPromptVisible,
    promptMode,
    handleSend,
    handleCancelPrompt,
    handleAutocompleteSelect,
    handleAutocompleteHover,
    handlePromptKeyDown,
    handlePromptModeChange,
    handleAgentGitAction,
  } = workspacePrompt;

  const prevThreadIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (prevThreadIdRef.current && prevThreadIdRef.current !== activeThreadId) {
      uiInteractionStore.getState().markThreadViewed(prevThreadIdRef.current);
    }
    if (activeThreadId) {
      uiInteractionStore.getState().markThreadViewed(activeThreadId);
    }
    prevThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  React.useEffect(() => {
    const conversation = {
      messages: agent.messages,
      status: agent.status,
      lastError: agent.lastError,
    } satisfies ThreadConversationState;

    if (!shouldPersistThreadConversation(conversation)) {
      return;
    }

    syncActiveThreadConversation({
      sessionStore: getWorkspaceSessionStore(),
      worktreeId: activeWorktreeId,
      threadId: activeThreadId,
      conversation,
    });
  }, [
    activeWorktreeId,
    activeThreadId,
    agent.lastError,
    agent.messages,
    agent.status,
  ]);

  React.useEffect(() => {
    const selection = shell.catalog.selection;
    if (
      !shouldRetryEmptyShellReload({
        repositoryCount: shell.catalog.repositories.length,
        selection,
      })
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void reload();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [reload, shell.catalog.repositories.length, shell.catalog.selection]);

  const activeThreadTitle = activeThread
    ? getThreadWindowTitle(activeThread)
    : null;
  const threadMessages = activeThreadConversation?.messages ?? agent.messages;
  const threadLastError =
    activeThreadConversation?.lastError ?? agent.lastError;
  const shellGit = shell.git ?? null;
  const appVersion = shell.appVersion ?? "";
  const contextUsage = agent.contextUsage;

  const workspaceShellProps: WorkspaceShellProps = React.useMemo(
    () => ({
      platform,
      appVersion,
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
      gitCommitMessage,
      threadMessages,
      threadLastError,
      contextWindows,
      selectedContextSurface,
      leftSidebarWidth,
      onSelectContextSurface: handleSelectContextSurface,
      onCloseFileWindow: handleCloseFileWindow,
      onLeftSidebarResize: handleLeftSidebarResize,
      onModelMenuOpenChange: handleModelMenuOpenChange,
      onAddRepository: addRepository,
      onSelectRepository: selectRepository,
      onRemoveRepository: removeRepository,
      onCopyRepositoryPath: copyRepositoryPath,
      onOpenInFinder: openInFinder,
      onCreateSession: createSession,
      onSelectWorktree: selectWorktree,
      onSelectThread: selectThread,
      onCreateThread: createThread,
      onCloseThread: closeThread,
      onDeleteThread: deleteThread,
      onDeleteWorktree: deleteWorktree,
      onOpenGit: handleOpenGit,
      onToggleTerminal: handleToggleTerminal,
      isTerminalVisible,
      onTerminalCommandComplete: refreshGitRepositoryStatus,
      onGitCommitMessageChange: setGitCommitMessage,
      onRefreshGit: refreshGitRepositoryStatus,
      onCommitGit: commitGitChanges,
      onCommitAndPushGit: commitAndPushGitChanges,
      onPullGit: pullGitChanges,
      onPushGit: pushGitChanges,
      onFetchGit: fetchGitChanges,
      onStageGitFile: stageGitFile,
      onStageAllGitFiles: stageAllGitFiles,
      onUnstageGitFile: unstageGitFile,
      onUnstageAllGitFiles: unstageAllGitFiles,
      onDiscardGitFile: discardGitFile,
      onFileContentChange: handleFileContentChange,
      onFileSave: handleFileSave,
      onDraftChange: setDraft,
      onSend: handleSend,
      onCancelPrompt: handleCancelPrompt,
      onAutocompleteSelect: handleAutocompleteSelect,
      onAutocompleteHover: handleAutocompleteHover,
      onPromptKeyDown: handlePromptKeyDown,
      onModelSelection: handleModelSelection,
      promptMode,
      onPromptModeChange: handlePromptModeChange,
      onConnectProvider: handleConnectProvider,
      favoriteModels,
      onToggleFavorite: handleToggleFavorite,
      workspacePath: activeWorktreePath,
      onFileTreeFileSelect: handleFileTreeFileSelect,
      onFileTreeDeleteFile: handleFileTreeDeleteFile,
      onFileTreeRenameFile: handleFileTreeRenameFile,
      onFileTreeMoveFile: handleFileTreeMoveFile,
      onAgentGitAction: handleAgentGitAction,
    }),
    [
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
      threadLastViewedAt,
      shellGit,
      gitCommitMessage,
      threadMessages,
      threadLastError,
      contextWindows,
      selectedContextSurface,
      leftSidebarWidth,
      handleSelectContextSurface,
      handleCloseFileWindow,
      handleLeftSidebarResize,
      handleModelMenuOpenChange,
      addRepository,
      selectRepository,
      removeRepository,
      copyRepositoryPath,
      openInFinder,
      createSession,
      selectWorktree,
      selectThread,
      createThread,
      closeThread,
      deleteThread,
      deleteWorktree,
      handleOpenGit,
      handleToggleTerminal,
      isTerminalVisible,
      setGitCommitMessage,
      refreshGitRepositoryStatus,
      commitGitChanges,
      commitAndPushGitChanges,
      pullGitChanges,
      pushGitChanges,
      fetchGitChanges,
      stageGitFile,
      stageAllGitFiles,
      unstageGitFile,
      unstageAllGitFiles,
      discardGitFile,
      handleFileContentChange,
      handleFileSave,
      setDraft,
      handleSend,
      handleCancelPrompt,
      handleAutocompleteSelect,
      handleAutocompleteHover,
      handlePromptKeyDown,
      handleModelSelection,
      promptMode,
      handlePromptModeChange,
      handleConnectProvider,
      favoriteModels,
      handleToggleFavorite,
      activeWorktreePath,
      handleFileTreeFileSelect,
      handleFileTreeDeleteFile,
      handleFileTreeRenameFile,
      handleFileTreeMoveFile,
      handleAgentGitAction,
      appVersion,
    ],
  );

  return {
    workspaceShellProps,
    ...appDialogs,
    ...workspacePrompt,
    ...workspaceTreeActions,
    ...workspaceWindows,
    ...workspaceShellControls,
    activeGitRepositoryStatus,
    gitCommitMessage,
    setGitCommitMessage,
    refreshGitRepositoryStatus,
    stageGitFile,
    stageAllGitFiles,
    unstageGitFile,
    unstageAllGitFiles,
    discardGitFile,
    commitGitChanges,
    commitAndPushGitChanges,
    pullGitChanges,
    pushGitChanges,
    fetchGitChanges,
    onAgentGitAction: handleAgentGitAction,
  };
}
