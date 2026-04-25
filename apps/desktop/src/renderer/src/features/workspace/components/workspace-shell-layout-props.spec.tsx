import type {
  GitRepositoryStatus,
  RepositorySnapshot,
  ShellGitSnapshot,
} from "@pi-desktop/shared";
import { describe, expect, it, vi } from "vitest";
import { buildWorkspaceShellLayoutProps } from "./workspace-shell-layout-props";

describe("buildWorkspaceShellLayoutProps", () => {
  it("assembles layout child props and hides the terminal aside when closed", () => {
    const repository: RepositorySnapshot = {
      id: "repo-1",
      name: "Alpha Workspace",
      customName: null,
      icon: null,
      accentColor: null,
      rootPath: "/tmp/alpha-workspace",
      defaultBranch: "main",
      worktrees: [
        {
          id: "worktree-1",
          label: "main",
          path: "/tmp/alpha-workspace/worktree-1",
          isMain: true,
          isDetached: false,
          git: {
            status: "ready",
            branch: "main",
            commit: "abc123",
            hasChanges: true,
            ahead: 1,
            behind: 0,
            stagedCount: 1,
            modifiedCount: 2,
            untrackedCount: 0,
            message: null,
          },
          threads: [
            {
              id: "thread-1",
              title: "Signal",
              lastActivityAt: 1,
              runtime: {
                status: "ready",
                lastError: null,
              },
            },
          ],
        },
      ],
    };

    const activeGitRepositoryStatus: GitRepositoryStatus | null = null;
    const shellGit: ShellGitSnapshot | null = null;
    const gitPanel = <div data-testid="git-panel" />;
    const filesPanel = <div data-testid="files-panel" />;
    const onLeftSidebarResize = vi.fn();
    const onSelectRepository = vi.fn();
    const onRemoveRepository = vi.fn();
    const onCopyRepositoryPath = vi.fn();
    const onOpenInFinder = vi.fn();
    const onCreateSession = vi.fn();
    const onSelectWorktree = vi.fn();
    const onSelectThread = vi.fn();
    const onDeleteWorktree = vi.fn();
    const onDeleteThread = vi.fn();
    const onArchiveWorktree = vi.fn();
    const onArchiveThread = vi.fn();
    const onCreateThread = vi.fn(async () => "thread-2");
    const onAddRepository = vi.fn();
    const onTargetMessageNavigated = vi.fn();
    const onToggleTerminal = vi.fn();
    const onSelectContextSurface = vi.fn();
    const onCloseFileWindow = vi.fn();
    const onFileContentChange = vi.fn();
    const onFileSave = vi.fn();
    const onDraftChange = vi.fn();
    const onSend = vi.fn();
    const onCancelPrompt = vi.fn();
    const onAutocompleteSelect = vi.fn();
    const onAutocompleteHover = vi.fn();
    const onPromptKeyDown = vi.fn();
    const onModelMenuOpenChange = vi.fn();
    const onModelSelection = vi.fn();
    const onPromptModeChange = vi.fn();
    const onAgentGitAction = vi.fn();
    const onTerminalCommandComplete = vi.fn();

    const layoutProps = buildWorkspaceShellLayoutProps({
      platform: "darwin",
      appVersion: "1.0.0",
      repositories: [repository],
      activeRepositoryId: "repo-1",
      activeWorktreeId: "worktree-1",
      activeThreadId: "thread-1",
      isPromptExecuting: false,
      threadLastViewedAt: { "thread-1": 123 },
      leftSidebarWidth: 240,
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
      activeThreadTitle: "Signal",
      hasActiveThread: true,
      hasChangesToCommit: true,
      hasCommitsToPush: true,
      isTerminalVisible: false,
      draft: "hello",
      canSend: true,
      autocompleteSuggestions: [],
      autocompleteSelectedIndex: -1,
      displayAgentStatus: "Ready",
      runtimeModeLabel: "Build",
      providerSnapshots: [],
      currentModelValue: "google::gemini-2.5-pro",
      contextUsage: {
        tokens: 100,
        contextWindow: 1000,
        percent: 10,
      },
      isSwitchingModel: false,
      isPromptVisible: true,
      promptMode: "build",
      threadMessages: [],
      threadLastError: null,
      contextWindows: [],
      selectedContextSurface: null,
      selectedFileWindow: null,
      targetMessageId: "message-9",
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
      onConnectProvider: undefined,
      favoriteModels: undefined,
      onToggleFavorite: undefined,
      onAgentGitAction,
      workspacePath: "/test/workspace",
      onTerminalCommandComplete,
      activeGitRepositoryStatus,
      shellGit,
    });

    expect(layoutProps.leftSidebarProps).toMatchObject({
      platform: "darwin",
      appVersion: "1.0.0",
      activeRepositoryId: "repo-1",
      activeWorktreeId: "worktree-1",
      activeThreadId: "thread-1",
      width: 240,
      onResize: onLeftSidebarResize,
      onSelectRepository,
      onAddRepository,
      gitPanel,
      filesPanel,
    });
    expect(layoutProps.mainPaneProps).toMatchObject({
      activeThreadTitle: "Signal",
      hasActiveThread: true,
      hasChangesToCommit: true,
      hasCommitsToPush: true,
      targetMessageId: "message-9",
      onTargetMessageNavigated,
      onToggleTerminal,
      onAgentGitAction,
    });
    expect(layoutProps.terminalAsideProps).toBeNull();
    expect(layoutProps.statusBarProps).toEqual({
      gitStatus: activeGitRepositoryStatus,
      shellGit,
      currentModelValue: "google::gemini-2.5-pro",
    });
  });
});
