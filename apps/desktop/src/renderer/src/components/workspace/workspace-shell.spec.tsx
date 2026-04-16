import type { RepositorySnapshot } from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
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

vi.mock("./left-rail", () => ({
  SIDEBAR_WIDTH: 240,
  LeftRail(props: { onSelectRepository?: unknown }) {
    return (
      <div
        data-testid="mock-left-rail"
        data-has-select-repository={String(
          typeof props.onSelectRepository === "function",
        )}
      >
        Left rail
      </div>
    );
  },
}));

vi.mock("./prompt-dock", () => ({
  PromptDock() {
    return <div data-testid="prompt-dock">Prompt Dock</div>;
  },
}));

vi.mock("./workspace-activity-panel", () => ({
  WorkspaceActivityPanel() {
    return <div data-testid="workspace-activity-panel">Activity</div>;
  },
}));

vi.mock("./workspace-surface-panel", () => ({
  WorkspaceSurfacePanel() {
    return <div data-testid="workspace-surface-panel">Surface Panel</div>;
  },
}));

vi.mock("./workspace-file-content", () => ({
  WorkspaceFileContent({ filePath }: { filePath: string }) {
    return <div data-testid="workspace-file-content">{filePath}</div>;
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
    activeGitRepositoryStatus: null,
    shellGit: null,
    gitCommitMessage: "",
    threadMessages: [],
    threadLastError: null,
    liveFeed: {
      currentTurnId: null,
      turns: [],
      toolsById: {},
      activity: [],
      lastEventSequence: 0,
      lastEventTimestamp: null,
      snapshotLoadedAt: null,
    },
    contextWindows: [],
    selectedContextSurface: null,
    leftRailWidth: 240,
    onSelectContextSurface: vi.fn(),
    onCloseFileWindow: vi.fn(),
    onLeftRailResize: vi.fn(),
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
    onOpenGit: vi.fn(),
    onOpenTerminal: vi.fn(),
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
  it("keeps the right panel visible by default and lets the title bar collapse it", async () => {
    const user = userEvent.setup();

    render(<WorkspaceShell {...createWorkspaceShellProps()} />);

    const sidePanel = screen.getByTestId("workspace-side-panel");
    expect(sidePanel).toHaveClass("w-[300px]");

    await user.click(screen.getByRole("button", { name: "Toggle side panel" }));
    expect(sidePanel).toHaveClass("w-0");

    await user.click(screen.getByRole("button", { name: "Toggle side panel" }));
    expect(sidePanel).toHaveClass("w-[300px]");
  });

  it("forwards terminal launches from the title bar", async () => {
    const user = userEvent.setup();
    const onOpenTerminal = vi.fn();

    render(
      <WorkspaceShell
        {...createWorkspaceShellProps({
          onOpenTerminal,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open terminal" }));

    expect(onOpenTerminal).toHaveBeenCalledTimes(1);
  });

  it("renders thread tabs above message area and creates threads inside active session", async () => {
    const user = userEvent.setup();
    const onCreateThread = vi.fn(async () => "thread-3");
    const onSelectThread = vi.fn();
    const onCloseThread = vi.fn();

    render(
      <WorkspaceShell
        {...createWorkspaceShellProps({
          onCreateThread,
          onSelectThread,
          onCloseThread,
        })}
      />,
    );

    expect(screen.getByText("Signal")).toBeInTheDocument();
    expect(screen.getByText("Echo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Echo" }));
    await user.click(screen.getByRole("button", { name: "Close Signal" }));
    await user.click(screen.getByRole("button", { name: "Create thread" }));

    expect(onSelectThread).toHaveBeenCalledWith("thread-2");
    expect(onCloseThread).toHaveBeenCalledWith("thread-1");
    expect(onCreateThread).toHaveBeenCalledWith("worktree-1");
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

    expect(screen.getByTestId("mock-left-rail")).toHaveAttribute(
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

  it("renders selected file windows in the center pane instead of the right panel", () => {
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

    expect(screen.getByTestId("workspace-chat-panel")).toContainElement(
      screen.getByTestId("workspace-file-content"),
    );
    expect(screen.getByText("workspace-shell.tsx")).toBeInTheDocument();
    expect(
      screen.queryByTestId("workspace-surface-panel"),
    ).not.toBeInTheDocument();
  });

  it("renders files and threads inside one shared primary tab bar", () => {
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

    expect(screen.getAllByTestId("thread-tabs")).toHaveLength(1);
    expect(screen.getByTestId("thread-tabs")).toContainElement(
      screen.getByText("Signal"),
    );
    expect(screen.getByTestId("thread-tabs")).toContainElement(
      screen.getByText("workspace-shell.tsx"),
    );
  });

  it("lets users switch back to chat threads from the shared primary tab bar", async () => {
    const user = userEvent.setup();
    const onSelectThread = vi.fn();

    render(
      <WorkspaceShell
        {...createWorkspaceShellProps({
          onSelectThread,
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

    await user.click(screen.getByRole("button", { name: "Signal" }));

    expect(onSelectThread).toHaveBeenCalledWith("thread-1");
  });

  it("lets users close file tabs from the shared primary tab bar", async () => {
    const user = userEvent.setup();
    const onCloseFileWindow = vi.fn();

    render(
      <WorkspaceShell
        {...createWorkspaceShellProps({
          onCloseFileWindow,
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
              isDirty: true,
              encoding: "utf-8",
              isReadOnly: false,
            },
          ],
          selectedContextSurface: "file-window-1",
        })}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Close workspace-shell.tsx" }),
    );

    expect(onCloseFileWindow).toHaveBeenCalledWith("file-window-1");
  });
});
