// @vitest-environment jsdom
import type { RepositorySnapshot } from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceShell } from "./workspace-shell";

const gitPanelPropsSpy = vi.fn();

vi.mock("./chat-thread-panel", () => ({
  ChatThreadPanel() {
    return <div data-testid="chat-thread-panel">Chat</div>;
  },
}));

vi.mock("./git-panel", () => ({
  GitPanel(props: Record<string, unknown>) {
    gitPanelPropsSpy(props);
    return <div data-testid="git-panel">Git Panel</div>;
  },
}));

vi.mock("./left-sidebar", () => ({
  SIDEBAR_WIDTH: 240,
  LeftSidebar(props: {
    width?: number;
    onSelectRepository?: unknown;
    gitPanel?: ReactNode;
    filesPanel?: ReactNode;
  }) {
    return (
      <div
        data-testid="mock-left-sidebar"
        data-sidebar-width={String(props.width ?? "")}
        data-has-select-repository={String(
          typeof props.onSelectRepository === "function",
        )}
      >
        Left rail
        {props.gitPanel}
        {props.filesPanel}
      </div>
    );
  },
}));

vi.mock("./prompt-dock", () => ({
  PromptDock() {
    return <div data-testid="prompt-dock">Prompt Dock</div>;
  },
}));

vi.mock("./center-file-viewer", () => ({
  CenterFileViewer({ filePath }: { filePath: string }) {
    return <div data-testid="workspace-file-content">{filePath}</div>;
  },
}));

vi.mock("./file-tree-panel", () => ({
  FileTreePanel() {
    return <div data-testid="file-tree-panel">Files</div>;
  },
}));

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
            {
              id: "thread-2",
              title: "Echo",
              lastActivityAt: 2,
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

beforeEach(() => {
  Object.defineProperty(window, "piDesktop", {
    configurable: true,
    value: {
      window: {
        getFullscreenState: vi.fn(async () => false),
        onFullscreenChanged: vi.fn(() => () => undefined),
      },
    },
  });
});

afterEach(() => {
  cleanup();
  gitPanelPropsSpy.mockReset();
});

describe("WorkspaceShell", () => {
  it("renders chat thread panel and prompt dock by default", () => {
    render(<WorkspaceShell {...createWorkspaceShellProps()} />);

    expect(screen.queryByTestId("thread-tabs")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-thread-panel")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-dock")).toBeInTheDocument();
  });

  it("forwards workspace switching into left rail", () => {
    const onSelectRepository = vi.fn();

    render(
      <WorkspaceShell
        {...createWorkspaceShellProps({
          onSelectRepository,
        })}
      />,
    );

    expect(screen.getByTestId("mock-left-sidebar")).toHaveAttribute(
      "data-has-select-repository",
      "true",
    );
  });

  it("passes bulk git handlers through to the git panel", () => {
    const onStageAllGitFiles = vi.fn();
    const onUnstageAllGitFiles = vi.fn();

    render(
      <WorkspaceShell
        {...createWorkspaceShellProps({
          onStageAllGitFiles,
          onUnstageAllGitFiles,
        })}
      />,
    );

    expect(gitPanelPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onStageAllFiles: onStageAllGitFiles,
        onUnstageAllFiles: onUnstageAllGitFiles,
      }),
    );
  });

  it("renders selected file windows in the center pane", () => {
    render(
      <WorkspaceShell
        {...createWorkspaceShellProps({
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
              state: "normal" as const,
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

    expect(screen.getByTestId("workspace-chat-panel")).toContainElement(
      screen.getByTestId("workspace-file-content"),
    );
    expect(
      screen.getByText("/tmp/alpha-workspace/workspace-shell.tsx"),
    ).toBeInTheDocument();
  });

  it("does not render breadcrumb in shell when no file window is selected", () => {
    const { container } = render(
      <WorkspaceShell {...createWorkspaceShellProps()} />,
    );

    expect(container.querySelector("[data-testid='breadcrumb']")).toBeNull();
  });
});
