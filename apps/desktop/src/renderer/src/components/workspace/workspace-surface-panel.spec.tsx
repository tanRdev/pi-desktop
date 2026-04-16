import type { WorkspaceWindow } from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { WorkspaceSurfacePanel } from "./workspace-surface-panel";

let fileWindowState:
  | {
      content: { type: "text"; content: string; encoding: string } | null;
      isLoading: boolean;
      error: string | null;
    }
  | undefined;

vi.mock("../../hooks/use-window-store", () => {
  const store = createStore(() => ({}));
  return {
    getWorkspaceSessionStore: () => store,
  };
});

vi.mock("../../stores/workspace-session-selectors", () => ({
  selectFileWindowStateByWorktree: () => fileWindowState,
}));

vi.mock("../ui/terminal", () => ({
  Terminal({ backend, cwd }: { backend: string; cwd: string }) {
    return <div>{`Terminal ${backend} ${cwd}`}</div>;
  },
}));

vi.mock("./workspace-file-content", () => ({
  WorkspaceFileContent({
    filePath,
    onSave,
  }: {
    filePath: string;
    onSave: () => void | Promise<void>;
  }) {
    return (
      <div>
        <span>{filePath}</span>
        <button type="button" onClick={() => void onSave()}>
          Save file
        </button>
      </div>
    );
  },
}));

function createWindow(
  window: Extract<WorkspaceWindow, { kind: "file" | "terminal" | "git" }>,
) {
  return window;
}

afterEach(() => {
  cleanup();
  fileWindowState = undefined;
});

describe("WorkspaceSurfacePanel", () => {
  it("falls back to the activity content when no contextual window is selected", () => {
    render(
      <WorkspaceSurfacePanel
        activeWorktreeId="worktree-1"
        selectedSurfaceKey="missing"
        windows={[]}
        activityContent={<div>Git activity</div>}
        onFileContentChange={vi.fn()}
        onFileSave={vi.fn()}
      />,
    );

    expect(screen.getByTestId("workspace-context-panel")).toBeVisible();
    expect(screen.getByText("Git activity")).toBeInTheDocument();
  });

  it("renders terminal windows in the dedicated right panel", () => {
    render(
      <WorkspaceSurfacePanel
        activeWorktreeId="worktree-1"
        selectedSurfaceKey="window-terminal"
        windows={[
          createWindow({
            id: "window-terminal",
            kind: "terminal",
            title: "Terminal",
            x: 0,
            y: 0,
            width: 300,
            height: 400,
            zIndex: 1,
            isFocused: true,
            state: "normal",
            terminalId: "term-1",
            backend: "shell",
            cwd: "/tmp/repo",
          }),
        ]}
        activityContent={<div>Git activity</div>}
        onFileContentChange={vi.fn()}
        onFileSave={vi.fn()}
      />,
    );

    expect(screen.getByText("Terminal shell /tmp/repo")).toBeInTheDocument();
  });

  it("renders file windows with save handling", async () => {
    const user = userEvent.setup();
    const onFileSave = vi.fn(async () => undefined);
    fileWindowState = {
      content: {
        type: "text",
        content: "export const value = 1;",
        encoding: "utf-8",
      },
      isLoading: false,
      error: null,
    };

    render(
      <WorkspaceSurfacePanel
        activeWorktreeId="worktree-1"
        selectedSurfaceKey="window-file"
        windows={[
          createWindow({
            id: "window-file",
            kind: "file",
            title: "index.ts",
            x: 0,
            y: 0,
            width: 300,
            height: 400,
            zIndex: 1,
            isFocused: true,
            state: "normal",
            filePath: "/tmp/repo/index.ts",
            isDirty: false,
            encoding: "utf-8",
            isReadOnly: false,
          }),
        ]}
        activityContent={<div>Git activity</div>}
        onFileContentChange={vi.fn()}
        onFileSave={onFileSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save file" }));

    expect(screen.getByText("/tmp/repo/index.ts")).toBeInTheDocument();
    expect(onFileSave).toHaveBeenCalledWith(
      "window-file",
      "/tmp/repo/index.ts",
    );
  });
});
