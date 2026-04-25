// @vitest-environment jsdom

import type { RepositorySnapshot } from "@pi-desktop/shared";
import { render, screen } from "@testing-library/react";
import type * as React from "react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

type WorkspaceShellLayoutSeamProps = {
  leftSidebarProps: {
    width: number;
    activeRepositoryId: string | null;
    gitPanel?: React.ReactNode;
    filesPanel?: React.ReactNode;
  };
  mainPaneProps: {
    hasActiveThread: boolean;
    selectedFileWindow: {
      filePath: string;
    } | null;
  };
  terminalAsideProps: {
    workspacePath: string | null;
  } | null;
  statusBarProps: {
    currentModelValue?: string | null;
  };
};

const workspaceShellLayoutMock = vi.fn<
  (props: WorkspaceShellLayoutSeamProps) => React.JSX.Element
>(() => <div data-testid="workspace-shell-layout-seam" />);

vi.mock("./workspace-shell-layout", () => ({
  WorkspaceShellLayout(props: WorkspaceShellLayoutSeamProps) {
    workspaceShellLayoutMock(props);
    return <div data-testid="workspace-shell-layout-seam" />;
  },
}));

vi.mock("./workspace-shell-fullscreen", () => ({
  useWorkspaceShellFullscreen() {
    return undefined;
  },
}));

vi.mock("./workspace-shell-events", () => ({
  useWorkspaceShellEvents() {
    return undefined;
  },
}));

vi.mock("./left-sidebar", () => ({
  SIDEBAR_WIDTH: 240,
  LeftSidebar() {
    return <div data-testid="left-sidebar" />;
  },
}));

vi.mock("./workspace-shell-main-pane", () => ({
  WorkspaceShellMainPane() {
    return <div data-testid="workspace-shell-main-pane" />;
  },
}));

vi.mock("./workspace-shell-terminal-aside", () => ({
  WorkspaceShellTerminalAside() {
    return <div data-testid="workspace-shell-terminal-aside" />;
  },
}));

vi.mock("./status-bar", () => ({
  StatusBar() {
    return <div data-testid="status-bar" />;
  },
}));

import { WorkspaceShell } from "./workspace-shell";

function createWorkspaceShellProps(
  overrides: Partial<ComponentProps<typeof WorkspaceShell>> = {},
): ComponentProps<typeof WorkspaceShell> {
  const repositories: RepositorySnapshot[] = [
    {
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
          path: "/tmp/alpha-workspace",
          isMain: true,
          isDetached: false,
          git: {
            status: "ready",
            branch: "main",
            commit: "abc123",
            hasChanges: false,
            ahead: 0,
            behind: 0,
            stagedCount: 0,
            modifiedCount: 0,
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
    },
  ];

  return {
    platform: "darwin",
    repositories,
    activeRepository: repositories[0] ?? null,
    activeRepositoryId: "repo-1",
    activeWorktreeId: "worktree-1",
    activeThreadId: "thread-1",
    activeThreadTitle: "Signal",
    draft: "",
    canSend: true,
    autocompleteSuggestions: [],
    autocompleteSelectedIndex: -1,
    displayAgentStatus: "Ready",
    runtimeModeLabel: "Build",
    providerSnapshots: [],
    currentModelValue: "google::gemini-2.5-pro",
    contextUsage: {
      tokens: 100,
      contextWindow: 1_000,
      percent: 10,
    },
    isSwitchingModel: false,
    isPromptVisible: true,
    isPromptExecuting: false,
    threadLastViewedAt: {},
    activeGitRepositoryStatus: null,
    shellGit: null,
    gitCommitMessage: "",
    threadMessages: [],
    threadLastError: null,
    contextWindows: [],
    selectedContextSurface: null,
    leftSidebarWidth: 240,
    onSelectContextSurface: vi.fn(),
    onCloseFileWindow: vi.fn(),
    onLeftSidebarResize: vi.fn(),
    onModelMenuOpenChange: vi.fn(),
    onAddRepository: vi.fn(),
    onSelectRepository: vi.fn(),
    onRemoveRepository: vi.fn(),
    onCopyRepositoryPath: vi.fn(),
    onOpenInFinder: vi.fn(),
    onCreateSession: vi.fn(),
    onSelectWorktree: vi.fn(),
    onSelectThread: vi.fn(),
    onCreateThread: vi.fn(async () => "thread-2"),
    onCloseThread: vi.fn(),
    onDeleteThread: vi.fn(),
    onDeleteWorktree: vi.fn(),
    onArchiveWorktree: vi.fn(),
    onArchiveThread: vi.fn(),
    onOpenGit: vi.fn(),
    onToggleTerminal: vi.fn(),
    isTerminalVisible: false,
    onTerminalCommandComplete: vi.fn(),
    onGitCommitMessageChange: vi.fn(),
    onRefreshGit: vi.fn(),
    onCommitGit: vi.fn(),
    onCommitAndPushGit: vi.fn(),
    onFetchGit: vi.fn(),
    onPullGit: vi.fn(),
    onPushGit: vi.fn(),
    onStageGitFile: vi.fn(),
    onStageAllGitFiles: vi.fn(),
    onUnstageGitFile: vi.fn(),
    onUnstageAllGitFiles: vi.fn(),
    onDiscardGitFile: vi.fn(),
    onFileContentChange: vi.fn(),
    onFileSave: vi.fn(),
    onDraftChange: vi.fn(),
    onSend: vi.fn(),
    onCancelPrompt: vi.fn(),
    onAutocompleteSelect: vi.fn(),
    onAutocompleteHover: vi.fn(),
    onPromptKeyDown: vi.fn(),
    onModelSelection: vi.fn(),
    promptMode: "build",
    onPromptModeChange: vi.fn(),
    workspacePath: "/test/workspace",
    onFileTreeFileSelect: vi.fn(),
    onFileTreeDeleteFile: vi.fn(),
    onFileTreeRenameFile: vi.fn(),
    onFileTreeMoveFile: vi.fn(),
    onAgentGitAction: vi.fn(),
    onConnectProvider: undefined,
    favoriteModels: undefined,
    onToggleFavorite: undefined,
    ...overrides,
  };
}

describe("WorkspaceShell layout seam", () => {
  it("delegates outer layout composition to the dedicated layout component", () => {
    render(
      <WorkspaceShell
        {...createWorkspaceShellProps({
          isTerminalVisible: true,
          contextWindows: [
            {
              id: "file-window-1",
              kind: "file",
              title: "workspace-shell.tsx",
              x: 0,
              y: 0,
              width: 300,
              height: 400,
              zIndex: 1,
              isFocused: true,
              state: "normal",
              filePath: "/tmp/alpha-workspace/workspace-shell.tsx",
              isDirty: false,
              encoding: "utf-8",
              isReadOnly: false,
            },
          ],
          selectedContextSurface: "file-window-1",
        })}
      />,
    );

    expect(
      screen.getByTestId("workspace-shell-layout-seam"),
    ).toBeInTheDocument();
    expect(workspaceShellLayoutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leftSidebarProps: expect.objectContaining({
          width: 240,
          activeRepositoryId: "repo-1",
          gitPanel: expect.any(Object),
          filesPanel: expect.any(Object),
        }),
        mainPaneProps: expect.objectContaining({
          hasActiveThread: true,
          selectedFileWindow: expect.objectContaining({
            filePath: "/tmp/alpha-workspace/workspace-shell.tsx",
          }),
        }),
        terminalAsideProps: expect.objectContaining({
          workspacePath: "/test/workspace",
        }),
        statusBarProps: expect.objectContaining({
          currentModelValue: "google::gemini-2.5-pro",
        }),
      }),
    );
  });
});
