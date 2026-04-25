// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceShellMainPaneProps } from "./workspace-shell-main-pane";
import { WorkspaceShellMainPane } from "./workspace-shell-main-pane";

vi.mock("./title-bar", () => ({
  TitleBar() {
    return <div data-testid="title-bar">Title Bar</div>;
  },
}));

vi.mock("./prompt-dock", () => ({
  PromptDock() {
    return <div data-testid="prompt-dock">Prompt Dock</div>;
  },
}));

vi.mock("./chat-thread-panel", () => ({
  ChatThreadPanel() {
    return <div data-testid="chat-thread-panel">Chat Thread</div>;
  },
}));

vi.mock("./center-file-viewer", () => ({
  CenterFileViewer({ filePath }: { filePath: string }) {
    return <div data-testid="workspace-file-content">{filePath}</div>;
  },
}));

function createMainPaneProps(
  overrides: Partial<WorkspaceShellMainPaneProps> = {},
): WorkspaceShellMainPaneProps {
  return {
    platform: "darwin",
    activeWorktreeId: "worktree-1",
    activeThreadId: "thread-1",
    activeThreadTitle: "Signal",
    hasActiveThread: true,
    hasChangesToCommit: false,
    hasCommitsToPush: false,
    isPromptExecuting: false,
    isTerminalVisible: false,
    contextWindows: [],
    selectedContextSurface: null,
    selectedFileWindow: null,
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
    promptMode: "build",
    threadMessages: [],
    threadLastError: null,
    targetMessageId: null,
    onTargetMessageNavigated: vi.fn(),
    onToggleTerminal: vi.fn(),
    onSelectContextSurface: vi.fn(),
    onCloseFileWindow: vi.fn(),
    onFileContentChange: vi.fn(),
    onFileSave: vi.fn(),
    onDraftChange: vi.fn(),
    onSend: vi.fn(),
    onCancelPrompt: vi.fn(),
    onAutocompleteSelect: vi.fn(),
    onAutocompleteHover: vi.fn(),
    onPromptKeyDown: vi.fn(),
    onModelMenuOpenChange: vi.fn(),
    onModelSelection: vi.fn(),
    onPromptModeChange: vi.fn(),
    onConnectProvider: undefined,
    favoriteModels: undefined,
    onToggleFavorite: undefined,
    onAgentGitAction: vi.fn(),
    ...overrides,
  };
}

describe("WorkspaceShellMainPane", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the chat thread and prompt dock when no file is selected", () => {
    render(<WorkspaceShellMainPane {...createMainPaneProps()} />);

    expect(screen.getByTestId("title-bar")).toBeInTheDocument();
    expect(screen.getByTestId("chat-thread-panel")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-dock")).toBeInTheDocument();
  });

  it("renders the selected file and hides the prompt dock", () => {
    render(
      <WorkspaceShellMainPane
        {...createMainPaneProps({
          selectedFileWindow: {
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
        })}
      />,
    );

    expect(screen.getByTestId("workspace-file-content")).toHaveTextContent(
      "/tmp/alpha-workspace/workspace-shell.tsx",
    );
    expect(screen.queryByTestId("prompt-dock")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-thread-panel")).not.toBeInTheDocument();
  });
});
