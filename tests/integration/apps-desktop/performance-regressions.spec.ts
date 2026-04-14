import { performance } from "node:perf_hooks";
import { describe, expect, it, vi } from "vitest";
import { createWindowStoreSnapshotCache } from "../../../apps/desktop/src/renderer/src/hooks/use-window-store";
import { createWorkspaceSessionStore } from "../../../apps/desktop/src/renderer/src/stores/workspace-session-store";
import { createEmptyWorkspaceSession } from "../../../packages/shared/src";

describe("performance regressions", () => {
  it("updates thread conversation without replacing layout references across 100 writes", () => {
    const sessionStore = createWorkspaceSessionStore({
      getWorkspaceSession: async () => null,
      saveWorkspaceSession: async (session) => session,
    });
    const worktreeId = "/tmp/repo-a";
    sessionStore
      .getState()
      .hydrateCatalogSessions([createEmptyWorkspaceSession(worktreeId)]);

    const initialLayout =
      sessionStore.getState().sessionsByWorktreeId[worktreeId]?.layout;
    if (!initialLayout) {
      throw new Error("Expected initial layout");
    }

    const startedAt = performance.now();

    for (let index = 0; index < 100; index += 1) {
      sessionStore
        .getState()
        .setThreadConversationForWorktree(worktreeId, "thread-1", {
          messages: [
            {
              id: `assistant-${index}`,
              role: "assistant",
              text: `Message ${index}`,
              status: "complete",
              timestamp: index,
            },
          ],
          status: "ready",
          lastError: null,
        });
    }

    const durationMs = performance.now() - startedAt;
    const finalLayout =
      sessionStore.getState().sessionsByWorktreeId[worktreeId]?.layout;

    expect(finalLayout).toBe(initialLayout);
    expect(durationMs).toBeLessThan(25);
  });

  it("reuses cached window-store snapshots for unchanged layout state", () => {
    const cache = createWindowStoreSnapshotCache();
    const session = createEmptyWorkspaceSession("/tmp/repo-a");
    const firstSnapshot = cache.getSnapshot({
      layout: session.layout,
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });

    const startedAt = performance.now();
    let nextSnapshot = firstSnapshot;

    for (let index = 0; index < 1_000; index += 1) {
      nextSnapshot = cache.getSnapshot({
        layout: session.layout,
        draggingWindowId: null,
        resizingWindowId: null,
        snapPreview: null,
      });
    }

    const durationMs = performance.now() - startedAt;

    expect(nextSnapshot).toBe(firstSnapshot);
    expect(durationMs).toBeLessThan(5);
  });

  it("memoized git inspection cache returns repeated repository lookups within TTL", () => {
    const service = {
      inspect: vi.fn(() => ({ status: "repository" as const })),
    };

    const cache = new Map<
      string,
      { value: { status: "repository" }; updatedAt: number }
    >();
    const lookup = (key: string) => {
      const cached = cache.get(key);
      if (cached && Date.now() - cached.updatedAt < 250) {
        return cached.value;
      }

      const value = service.inspect();
      cache.set(key, { value, updatedAt: Date.now() });
      return value;
    };

    lookup("/tmp/repo");
    lookup("/tmp/repo");
    lookup("/tmp/repo");

    expect(service.inspect).toHaveBeenCalledTimes(1);
  });
});
