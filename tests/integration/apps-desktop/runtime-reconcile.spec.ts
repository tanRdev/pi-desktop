import { describe, expect, it } from "vitest";
import { reconcileThreadRuntimeStates } from "../../../apps/desktop/src/main/runtime-reconcile";

describe("reconcileThreadRuntimeStates", () => {
  it("reports missing threads and stale managed runtimes", () => {
    const result = reconcileThreadRuntimeStates({
      managedRuntimeIds: ["local-thread-live", "local-thread-stale"],
      threadStates: [
        {
          threadId: "thread-live",
          worktreePath: "/tmp/live",
          runtimeId: "local-thread-live",
          status: "ready",
          lastError: null,
        },
        {
          threadId: "thread-missing",
          worktreePath: "/tmp/missing",
          runtimeId: "local-thread-missing",
          status: "exited",
          lastError: null,
        },
      ],
    });

    expect(result).toEqual({
      active: [
        {
          threadId: "thread-live",
          worktreePath: "/tmp/live",
          runtimeId: "local-thread-live",
          status: "ready",
          lastError: null,
        },
        {
          threadId: "thread-missing",
          worktreePath: "/tmp/missing",
          runtimeId: "local-thread-missing",
          status: "exited",
          lastError: null,
        },
      ],
      missingThreadIds: ["thread-missing"],
      staleRuntimeIds: ["local-thread-stale"],
    });
  });
});
