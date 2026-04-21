// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPEN_MESSAGE_EVENT, ThreadSearchHost } from "./thread-search-host";

const useShellModelMock = vi.fn();
const getWorkspaceSessionStoreMock = vi.fn();

vi.mock("@/hooks/use-shell-model", () => ({
  useShellModel: () => useShellModelMock(),
}));

vi.mock("@/hooks/use-window-store", () => ({
  getWorkspaceSessionStore: () => getWorkspaceSessionStoreMock(),
}));

vi.mock("@/lib/keyboard", () => ({
  globalShortcutRegistry: {
    register: vi.fn(() => () => undefined),
  },
}));

vi.mock("./thread-search-dialog", () => ({
  ThreadSearchDialog({
    open,
    onSelect,
    messages,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (result: {
      threadId: string;
      messageId: string;
      threadTitle: string;
      snippet: string;
      highlights: [];
      role: string;
    }) => void;
    messages: Array<unknown>;
  }) {
    if (!open) {
      return null;
    }

    return (
      <button
        type="button"
        data-testid="thread-search-select"
        data-message-count={String(messages.length)}
        onClick={() =>
          onSelect({
            threadId: "thread-2",
            messageId: "message-9",
            threadTitle: "Thread Two",
            snippet: "Needle result",
            highlights: [],
            role: "assistant",
          })
        }
      >
        Select result
      </button>
    );
  },
}));

function createShellState() {
  return {
    shell: {
      catalog: {
        selection: {
          repositoryId: "repo-1",
          worktreeId: "worktree-1",
          threadId: "thread-1",
        },
        repositories: [
          {
            id: "repo-1",
            name: "Repo",
            customName: null,
            icon: null,
            accentColor: null,
            rootPath: "/tmp/repo",
            defaultBranch: "main",
            worktrees: [
              {
                id: "worktree-1",
                label: "main",
                path: "/tmp/repo",
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
                    title: "Thread One",
                    lastActivityAt: 1,
                    runtime: { status: "ready", lastError: null },
                  },
                  {
                    id: "thread-2",
                    title: "Thread Two",
                    lastActivityAt: 2,
                    runtime: { status: "ready", lastError: null },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
}

describe("ThreadSearchHost", () => {
  beforeEach(() => {
    useShellModelMock.mockReturnValue({ state: createShellState() });
    getWorkspaceSessionStoreMock.mockReturnValue({
      getState: () => ({
        activeWorktreeId: "worktree-1",
        sessionsByWorktreeId: {
          "worktree-1": {
            threadConversations: new Map([
              [
                "thread-2",
                {
                  messages: [
                    {
                      id: "message-9",
                      role: "assistant",
                      text: "Needle result",
                      status: "complete",
                      timestamp: 1,
                    },
                  ],
                },
              ],
            ]),
          },
        },
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens the search dialog when the open event is dispatched", () => {
    render(<ThreadSearchHost />);

    window.dispatchEvent(new Event("pi:thread-search:open"));

    return waitFor(() => {
      expect(screen.getByTestId("thread-search-select")).toBeInTheDocument();
    });
  });

  it("dispatches a thread-selection event when a search result is activated", async () => {
    const user = userEvent.setup();
    const selections: string[] = [];
    const openedMessages: Array<{ threadId: string; messageId: string }> = [];
    const listener = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      const detail = event.detail;
      if (!detail || typeof detail !== "object") {
        return;
      }

      if (typeof Reflect.get(detail, "threadId") === "string") {
        selections.push(String(Reflect.get(detail, "threadId")));
      }
    };
    const openMessageListener = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      const detail = event.detail;
      if (!detail || typeof detail !== "object") {
        return;
      }

      const threadId = Reflect.get(detail, "threadId");
      const messageId = Reflect.get(detail, "messageId");
      if (typeof threadId === "string" && typeof messageId === "string") {
        openedMessages.push({ threadId, messageId });
      }
    };

    window.addEventListener("pi:thread-select", listener);
    window.addEventListener(OPEN_MESSAGE_EVENT, openMessageListener);

    render(<ThreadSearchHost />);

    window.dispatchEvent(new Event("pi:thread-search:open"));

    const result = await screen.findByTestId("thread-search-select");
    await user.click(result);

    expect(selections).toEqual(["thread-2"]);
    expect(openedMessages).toEqual([
      { threadId: "thread-2", messageId: "message-9" },
    ]);

    window.removeEventListener("pi:thread-select", listener);
    window.removeEventListener(OPEN_MESSAGE_EVENT, openMessageListener);
  });
});
