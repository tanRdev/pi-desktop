import { describe, expect, it, vi } from "vitest";
import { createContextSwitchController } from "../../../apps/desktop/src/main/context-switch-controller";

function createThreadEntry(threadId: string, worktreeId: string) {
  return {
    id: threadId,
    worktreeId,
    title: "Thread",
    archivedAt: null,
    lastActivityAt: null,
    runtimeId: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("thread same-worktree fast path", () => {
  it("switches thread context without resolving repository inspection again", async () => {
    const attachContext = vi.fn(async (context) => ({
      context,
      host: {
        getProviders: vi.fn(async () => []),
        getSettings: vi.fn(async () => ({})),
        getSnapshot: vi.fn(async () => ({
          sessionId: context.thread.id,
          status: "ready" as const,
          messages: [],
          lastError: null,
        })),
        prompt: vi.fn(async () => undefined),
        cancelPrompt: vi.fn(async () => undefined),
        reset: vi.fn(async () => undefined),
        subscribe: vi.fn(() => () => undefined),
      },
      transport: { close: vi.fn() },
    }));
    const notifySessionChanged = vi.fn();
    const controller = createContextSwitchController(
      {
        context: {
          repositoryId: "repo-1",
          worktreePath: "/tmp/repo",
          thread: { id: "thread-1" },
        },
        host: {
          getProviders: vi.fn(async () => []),
          getSettings: vi.fn(async () => ({})),
          getSnapshot: vi.fn(async () => ({
            sessionId: "thread-1",
            status: "ready" as const,
            messages: [],
            lastError: null,
          })),
          prompt: vi.fn(async () => undefined),
          cancelPrompt: vi.fn(async () => undefined),
          reset: vi.fn(async () => undefined),
          subscribe: vi.fn(() => () => undefined),
        },
        transport: { close: vi.fn() },
        unsubscribe: vi.fn(),
      },
      {
        attachContext,
        subscribeToHost: vi.fn(() => vi.fn()),
        notifySessionChanged,
      },
    );

    await controller.switchContext(async () => ({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo",
      thread: { id: "thread-2" },
    }));

    expect(attachContext).toHaveBeenCalledTimes(1);
    expect(notifySessionChanged).toHaveBeenCalledTimes(2);
  });

  it("documents same-worktree thread metadata shape used by fast selection path", () => {
    expect(createThreadEntry("thread-2", "/tmp/repo")).toMatchObject({
      id: "thread-2",
      worktreeId: "/tmp/repo",
      archivedAt: null,
    });
  });
});
