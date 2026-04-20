import { describe, expect, it } from "vitest";
import {
  getMainPaneState,
  isPromptExecutionVisible,
  shouldRetryEmptyShellReload,
  shouldPersistThreadConversation,
} from "../../../apps/desktop/src/renderer/src/hooks/use-app-shell-controller";

describe("use-app-shell-controller helpers", () => {
  it("skips persisting empty loading conversations created by session switches", () => {
    expect(
      shouldPersistThreadConversation({
        messages: [],
        status: "starting",
        lastError: null,
      }),
    ).toBe(false);

    expect(
      shouldPersistThreadConversation({
        messages: [
          {
            id: "message-1",
            role: "user",
            text: "hello",
            status: "complete",
            timestamp: 1,
          },
        ],
        status: "starting",
        lastError: null,
      }),
    ).toBe(true);

    expect(
      shouldPersistThreadConversation({
        messages: [],
        status: "streaming",
        lastError: null,
      }),
    ).toBe(true);
  });

  it("only exposes prompt execution when the active thread is actually busy", () => {
    expect(
      isPromptExecutionVisible({
        activeThreadId: "thread-1",
        pendingPromptThreadId: null,
        conversation: {
          messages: [],
          status: "starting",
          lastError: null,
        },
      }),
    ).toBe(false);

    expect(
      isPromptExecutionVisible({
        activeThreadId: "thread-1",
        pendingPromptThreadId: "thread-1",
        conversation: undefined,
      }),
    ).toBe(true);

    expect(
      isPromptExecutionVisible({
        activeThreadId: "thread-1",
        pendingPromptThreadId: null,
        conversation: {
          messages: [],
          status: "streaming",
          lastError: null,
        },
      }),
    ).toBe(true);
  });

  it("routes file windows to the main pane and keeps side surfaces scoped to terminal and git", () => {
    expect(
      getMainPaneState({
        contextWindows: [
          {
            id: "file-window-1",
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
          },
        ],
        selectedContextSurface: "file-window-1",
      }),
    ).toEqual({
      fileWindows: ["file-window-1"],
      selectedFileWindowId: "file-window-1",
      sideSurfaceKey: null,
    });

    expect(
      getMainPaneState({
        contextWindows: [
          {
            id: "terminal-window-1",
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
          },
        ],
        selectedContextSurface: "terminal-window-1",
      }),
    ).toEqual({
      fileWindows: [],
      selectedFileWindowId: null,
      sideSurfaceKey: "terminal-window-1",
    });
  });

  it("only retries shell reloads for inconsistent empty catalogs", () => {
    expect(
      shouldRetryEmptyShellReload({
        repositoryCount: 0,
        selection: {
          repositoryId: null,
          worktreeId: null,
          threadId: null,
        },
      }),
    ).toBe(false);

    expect(
      shouldRetryEmptyShellReload({
        repositoryCount: 0,
        selection: {
          repositoryId: "/tmp/repo",
          worktreeId: null,
          threadId: null,
        },
      }),
    ).toBe(true);

    expect(
      shouldRetryEmptyShellReload({
        repositoryCount: 1,
        selection: {
          repositoryId: null,
          worktreeId: null,
          threadId: null,
        },
      }),
    ).toBe(false);
  });
});
