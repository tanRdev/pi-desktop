import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceShell } from "./workspace-shell";

vi.mock("./chat-thread-panel", () => ({
  ChatThreadPanel() {
    return <div data-testid="chat-thread-panel">Chat</div>;
  },
}));

vi.mock("./git-panel", () => ({
  GitPanel() {
    return <div data-testid="git-panel">Git Panel</div>;
  },
}));

vi.mock("./left-rail", () => ({
  SIDEBAR_WIDTH: 240,
  LeftRail() {
    return <div data-testid="mock-left-rail">Left rail</div>;
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

vi.mock("./workspace-overlays", () => ({
  FileTreeOverlay() {
    return <div data-testid="file-tree-overlay">File tree</div>;
  },
}));

vi.mock("./workspace-surface-panel", () => ({
  WorkspaceSurfacePanel() {
    return <div data-testid="workspace-surface-panel">Surface Panel</div>;
  },
}));

function createWorkspaceShellProps(
  overrides: Partial<ComponentProps<typeof WorkspaceShell>> = {},
): ComponentProps<typeof WorkspaceShell> {
  return {
    platform: "darwin",
    repositories: [],
    activeRepository: null,
    activeRepositoryId: null,
    activeWorktreeId: null,
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
    isFileTreeOpen: false,
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
    onLeftRailResize: vi.fn(),
    onModelMenuOpenChange: vi.fn(),
    onAddRepository: vi.fn(),
    onRemoveRepository: vi.fn(),
    onCopyRepositoryPath: vi.fn(),
    onOpenInFinder: vi.fn(),
    onSelectWorktree: vi.fn(),
    onSelectThread: vi.fn(),
    onCreateThread: vi.fn(async () => "thread-2"),
    onCloseThread: vi.fn(),
    onDeleteThread: vi.fn(),
    onCloseFileTree: vi.fn(),
    onOpenGit: vi.fn(),
    onOpenTerminal: vi.fn(),
    onGitCommitMessageChange: vi.fn(),
    onRefreshGit: vi.fn(),
    onCommitGit: vi.fn(),
    onPullGit: vi.fn(),
    onPushGit: vi.fn(),
    onStageGitFile: vi.fn(),
    onUnstageGitFile: vi.fn(),
    onDiscardGitFile: vi.fn(),
    onFileClick: vi.fn(),
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
});
