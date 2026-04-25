import { beforeEach, describe, expect, it, vi } from "vitest";

type TestSession = {
  count: number;
};

type TestState = {
  activeWorktreeId: string | null;
  activeWorktreeVersion: number;
  sessionsByWorktreeId: Record<string, TestSession>;
  marker: string;
};

function createTestStore(initialState: TestState) {
  let state = initialState;

  return {
    getState: () => state,
    setState: (updater: (current: TestState) => TestState) => {
      state = updater(state);
    },
  };
}

function updateTestSessionRecord(
  sessionsByWorktreeId: Record<string, TestSession>,
  worktreeId: string,
  updater: (session: TestSession) => TestSession,
) {
  const currentSession = sessionsByWorktreeId[worktreeId];
  if (!currentSession) {
    return sessionsByWorktreeId;
  }

  return {
    ...sessionsByWorktreeId,
    [worktreeId]: updater(currentSession),
  };
}

describe("workspace-session-store-session-operations", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("debounces persistence for repeated session updates", async () => {
    vi.useFakeTimers();

    const { createWorkspaceSessionOperationHelpers } = await import(
      "./workspace-session-store-session-operations"
    );
    const persisted: TestSession[] = [];
    const store = createTestStore({
      activeWorktreeId: "wt-1",
      activeWorktreeVersion: 3,
      sessionsByWorktreeId: {
        "wt-1": { count: 1 },
      },
      marker: "stable",
    });
    const operations = createWorkspaceSessionOperationHelpers({
      getState: store.getState,
      setState: store.setState,
      persistDelayMs: 25,
      persistSession: async (session: TestSession) => {
        persisted.push(session);
      },
      updateSessionRecord: updateTestSessionRecord,
    });

    operations.withActiveSession((session) => ({ count: session.count + 1 }));
    operations.withSession("wt-1", (session) => ({ count: session.count + 1 }));

    expect(store.getState().sessionsByWorktreeId["wt-1"]?.count).toBe(3);
    expect(persisted).toEqual([]);

    await vi.advanceTimersByTimeAsync(25);

    expect(persisted).toEqual([{ count: 3 }]);
    expect(store.getState().marker).toBe("stable");
  });

  it("skips updates when there is no active session and can disable persistence", async () => {
    vi.useFakeTimers();

    const { createWorkspaceSessionOperationHelpers } = await import(
      "./workspace-session-store-session-operations"
    );
    const persisted: TestSession[] = [];
    const store = createTestStore({
      activeWorktreeId: null,
      activeWorktreeVersion: 1,
      sessionsByWorktreeId: {
        "wt-1": { count: 4 },
      },
      marker: "unchanged",
    });
    const operations = createWorkspaceSessionOperationHelpers({
      getState: store.getState,
      setState: store.setState,
      persistDelayMs: 25,
      persistSession: async (session: TestSession) => {
        persisted.push(session);
      },
      updateSessionRecord: updateTestSessionRecord,
    });

    operations.withActiveSession((session) => ({ count: session.count + 1 }));
    operations.withSession(
      "wt-1",
      (session) => ({ count: session.count + 1 }),
      { persist: false },
    );

    await vi.runAllTimersAsync();

    expect(store.getState().sessionsByWorktreeId["wt-1"]?.count).toBe(5);
    expect(persisted).toEqual([]);
    expect(store.getState().marker).toBe("unchanged");
  });

  it("removes a worktree session and cancels any pending persistence", async () => {
    vi.useFakeTimers();

    const { createWorkspaceSessionOperationHelpers } = await import(
      "./workspace-session-store-session-operations"
    );
    const persisted: TestSession[] = [];
    const store = createTestStore({
      activeWorktreeId: "wt-1",
      activeWorktreeVersion: 7,
      sessionsByWorktreeId: {
        "wt-1": { count: 2 },
        "wt-2": { count: 9 },
      },
      marker: "present",
    });
    const operations = createWorkspaceSessionOperationHelpers({
      getState: store.getState,
      setState: store.setState,
      persistDelayMs: 25,
      persistSession: async (session: TestSession) => {
        persisted.push(session);
      },
      updateSessionRecord: updateTestSessionRecord,
    });

    operations.withSession("wt-1", (session) => ({ count: session.count + 1 }));
    operations.removeWorktreeSession("wt-1");

    await vi.runAllTimersAsync();

    expect(store.getState().sessionsByWorktreeId["wt-1"]).toBeUndefined();
    expect(store.getState().sessionsByWorktreeId["wt-2"]?.count).toBe(9);
    expect(store.getState().activeWorktreeId).toBeNull();
    expect(store.getState().activeWorktreeVersion).toBe(8);
    expect(store.getState().marker).toBe("present");
    expect(persisted).toEqual([]);
  });
});
