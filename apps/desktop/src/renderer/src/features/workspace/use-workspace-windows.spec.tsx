// @vitest-environment jsdom
import type { FileContent } from "@pi-desktop/shared";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextWindow } from "@/features/workspace/workspace-pane-state";
import { toast } from "@/lib/toast";
import {
  createWorkspaceSessionStore,
  type WorkspaceSessionStore,
} from "@/stores/workspace-session-store";
import {
  installMockPiDesktop,
  uninstallMockPiDesktop,
} from "../../../../test/mock-pi-desktop";
import { useWorkspaceWindows } from "./use-workspace-windows";

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

function requireNamespace(
  namespace: Record<string, ReturnType<typeof vi.fn>> | undefined,
  label: string,
) {
  if (!namespace) {
    throw new Error(`Missing mock namespace: ${label}`);
  }

  return namespace;
}

function makeSessionStore() {
  return createWorkspaceSessionStore({
    getWorkspaceSession: vi.fn(async () => null),
    saveWorkspaceSession: vi.fn(async (session) => session),
    persistDelayMs: 0,
  });
}

function getContextWindows(
  sessionStore: WorkspaceSessionStore,
  worktreeId = "wt-1",
): ContextWindow[] {
  const windows =
    sessionStore.getState().sessionsByWorktreeId[worktreeId]?.layout.windows ??
    [];

  return windows.filter(
    (window): window is ContextWindow =>
      window.kind === "file" ||
      window.kind === "terminal" ||
      window.kind === "git",
  );
}

function getWindows(sessionStore: WorkspaceSessionStore, worktreeId = "wt-1") {
  return (
    sessionStore.getState().sessionsByWorktreeId[worktreeId]?.layout.windows ??
    []
  );
}

function createWindowStore(sessionStore: WorkspaceSessionStore) {
  return {
    createWindow: vi.fn(sessionStore.getState().createWindow),
    closeWindow: vi.fn(sessionStore.getState().closeWindow),
    focusWindow: vi.fn(sessionStore.getState().focusWindow),
    updateWindow: vi.fn(sessionStore.getState().updateWindow),
    setDirty: vi.fn(sessionStore.getState().setDirty),
  };
}

function createFileContent(filePath: string, content: string): FileContent {
  return {
    type: "text",
    path: filePath,
    encoding: "utf8",
    content,
  };
}

describe("useWorkspaceWindows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    uninstallMockPiDesktop();
  });

  it("opens and reuses git context windows while toggling the terminal", async () => {
    const sessionStore = makeSessionStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    const windowStore = createWindowStore(sessionStore);

    const { result, rerender } = renderHook(
      ({ windows }) =>
        useWorkspaceWindows({
          activeRepositoryName: "Alpha Workspace",
          activeWorktreeId: "wt-1",
          activeWorktreePath: "/tmp/repo",
          windows,
          sessionStore,
          windowStore,
        }),
      {
        initialProps: {
          windows: getWindows(sessionStore),
        },
      },
    );

    expect(result.current.isTerminalVisible).toBe(false);

    act(() => {
      result.current.handleToggleTerminal();
    });

    expect(result.current.isTerminalVisible).toBe(true);

    act(() => {
      result.current.handleToggleTerminal();
    });

    expect(result.current.isTerminalVisible).toBe(false);

    act(() => {
      result.current.handleOpenGit();
    });

    const gitWindow = getContextWindows(sessionStore).find(
      (window) => window.kind === "git",
    );

    expect(gitWindow).not.toBeUndefined();
    expect(gitWindow?.title).toBe("Git · Alpha Workspace");
    expect(result.current.selectedContextSurface).toBe(gitWindow?.id ?? null);

    rerender({
      windows: getWindows(sessionStore),
    });

    act(() => {
      result.current.handleOpenGit();
    });

    expect(result.current.selectedContextSurface).toBeNull();

    act(() => {
      result.current.handleOpenGit();
    });

    expect(windowStore.focusWindow).toHaveBeenCalledWith(gitWindow?.id ?? "");
    expect(result.current.selectedContextSurface).toBe(gitWindow?.id ?? null);
  });

  it("selects and closes file context windows using adjacent fallback", async () => {
    const sessionStore = makeSessionStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    const windowStore = createWindowStore(sessionStore);
    const firstWindow = sessionStore.getState().createWindow({
      kind: "file",
      filePath: "/tmp/repo/src/alpha.ts",
    });
    const secondWindow = sessionStore.getState().createWindow({
      kind: "file",
      filePath: "/tmp/repo/src/beta.ts",
    });

    const { result } = renderHook(() =>
      useWorkspaceWindows({
        activeRepositoryName: "Alpha Workspace",
        activeWorktreeId: "wt-1",
        activeWorktreePath: "/tmp/repo",
        windows: getWindows(sessionStore),
        sessionStore,
        windowStore,
      }),
    );

    act(() => {
      result.current.handleSelectContextSurface(firstWindow.id);
    });

    expect(windowStore.focusWindow).toHaveBeenCalledWith(firstWindow.id);
    expect(result.current.selectedContextSurface).toBe(firstWindow.id);

    act(() => {
      result.current.handleCloseFileWindow(firstWindow.id);
    });

    expect(windowStore.closeWindow).toHaveBeenCalledWith(firstWindow.id);
    expect(result.current.selectedContextSurface).toBe(secondWindow.id);
    expect(
      getContextWindows(sessionStore).some(
        (window) => window.id === firstWindow.id,
      ),
    ).toBe(false);
  });

  it("opens file tree files and focuses existing windows on repeat selection", async () => {
    const sessionStore = makeSessionStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    const windowStore = createWindowStore(sessionStore);
    const filePath = "/tmp/repo/src/app.tsx";
    const api = installMockPiDesktop({
      fs: {
        readFile: vi.fn(async () => createFileContent(filePath, "hello world")),
      },
    });
    const fs = requireNamespace(api.fs, "fs");

    const { result, rerender } = renderHook(
      ({ windows }) =>
        useWorkspaceWindows({
          activeRepositoryName: "Alpha Workspace",
          activeWorktreeId: "wt-1",
          activeWorktreePath: "/tmp/repo",
          windows,
          sessionStore,
          windowStore,
        }),
      {
        initialProps: {
          windows: getWindows(sessionStore),
        },
      },
    );

    await act(async () => {
      await result.current.handleFileTreeFileSelect(filePath);
    });

    const openedWindow = getContextWindows(sessionStore).find(
      (window): window is Extract<ContextWindow, { kind: "file" }> =>
        window.kind === "file" && window.filePath === filePath,
    );

    expect(openedWindow).not.toBeUndefined();
    expect(result.current.selectedContextSurface).toBe(
      openedWindow?.id ?? null,
    );
    expect(fs.readFile).toHaveBeenCalledWith(filePath);
    expect(
      sessionStore
        .getState()
        .sessionsByWorktreeId["wt-1"]?.fileContents.get(openedWindow?.id ?? "")
        ?.content,
    ).toEqual(createFileContent(filePath, "hello world"));

    rerender({
      windows: getWindows(sessionStore),
    });

    await act(async () => {
      await result.current.handleFileTreeFileSelect(filePath);
    });

    expect(windowStore.createWindow).toHaveBeenCalledTimes(1);
    expect(windowStore.focusWindow).toHaveBeenCalledWith(
      openedWindow?.id ?? "",
    );
  });

  it("updates file drafts and saves them through the workspace session runtime", async () => {
    const sessionStore = makeSessionStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    const windowStore = createWindowStore(sessionStore);
    const createdWindow = sessionStore.getState().createWindow({
      kind: "file",
      filePath: "/tmp/repo/src/app.tsx",
    });
    if (createdWindow.kind !== "file") {
      throw new Error("Expected a file window");
    }
    const fileWindow = createdWindow;
    sessionStore.getState().setFileContentForWorktree("wt-1", fileWindow.id, {
      content: createFileContent(fileWindow.filePath, "initial"),
      isLoading: false,
      error: null,
    });
    const api = installMockPiDesktop({
      fs: {
        writeFile: vi.fn(async () => undefined),
      },
    });
    const fs = requireNamespace(api.fs, "fs");

    const { result } = renderHook(() =>
      useWorkspaceWindows({
        activeRepositoryName: "Alpha Workspace",
        activeWorktreeId: "wt-1",
        activeWorktreePath: "/tmp/repo",
        windows: getWindows(sessionStore),
        sessionStore,
        windowStore,
      }),
    );

    act(() => {
      result.current.handleFileContentChange(fileWindow.id, "updated content");
    });

    expect(
      sessionStore
        .getState()
        .sessionsByWorktreeId["wt-1"]?.fileContents.get(fileWindow.id)?.content,
    ).toEqual(createFileContent(fileWindow.filePath, "updated content"));
    expect(windowStore.setDirty).toHaveBeenCalledWith(fileWindow.id, true);

    await act(async () => {
      await result.current.handleFileSave(fileWindow.id, fileWindow.filePath);
    });

    expect(fs.writeFile).toHaveBeenCalledWith(
      fileWindow.filePath,
      "updated content",
    );
    expect(windowStore.setDirty).toHaveBeenCalledWith(fileWindow.id, false);
  });

  it("runs file-tree delete, rename, and move operations with success toasts", async () => {
    const sessionStore = makeSessionStore();
    await sessionStore.getState().setActiveWorktree("wt-1");
    const windowStore = createWindowStore(sessionStore);
    const api = installMockPiDesktop({
      fs: {
        deleteFile: vi.fn(async () => undefined),
        renameFile: vi.fn(async () => undefined),
        moveFile: vi.fn(async () => undefined),
      },
    });
    const fs = requireNamespace(api.fs, "fs");

    const { result } = renderHook(() =>
      useWorkspaceWindows({
        activeRepositoryName: "Alpha Workspace",
        activeWorktreeId: "wt-1",
        activeWorktreePath: "/tmp/repo",
        windows: getWindows(sessionStore),
        sessionStore,
        windowStore,
      }),
    );

    await act(async () => {
      await result.current.handleFileTreeDeleteFile("/tmp/repo/src/alpha.ts");
      await result.current.handleFileTreeRenameFile(
        "/tmp/repo/src/alpha.ts",
        "/tmp/repo/src/beta.ts",
      );
      await result.current.handleFileTreeMoveFile(
        "/tmp/repo/src/beta.ts",
        "/tmp/repo/archive/beta.ts",
      );
    });

    expect(fs.deleteFile).toHaveBeenCalledWith("/tmp/repo/src/alpha.ts");
    expect(fs.renameFile).toHaveBeenCalledWith(
      "/tmp/repo/src/alpha.ts",
      "/tmp/repo/src/beta.ts",
    );
    expect(fs.moveFile).toHaveBeenCalledWith(
      "/tmp/repo/src/beta.ts",
      "/tmp/repo/archive/beta.ts",
    );
    expect(toast.success).toHaveBeenCalledWith("Deleted", {
      description: "alpha.ts",
    });
    expect(toast.success).toHaveBeenCalledWith("Renamed", {
      description: "beta.ts",
    });
    expect(toast.success).toHaveBeenCalledWith("Moved", {
      description: "beta.ts",
    });
  });
});
