import { describe, expect, it } from "vitest";
import { reconcileThreadRuntimeStates } from "../../../apps/desktop/src/main/runtime-reconcile";

describe("reconcileThreadRuntimeStates", () => {
  it("reports missing threads and stale managed tmux sessions", () => {
    const result = reconcileThreadRuntimeStates({
      managedSessionNames: ["pidesk-thread-live", "pidesk-thread-stale"],
      threadStates: [
        {
          threadId: "thread-live",
          worktreePath: "/tmp/live",
          sessionName: "pidesk-thread-live",
          status: "ready",
          lastError: null,
        },
        {
          threadId: "thread-missing",
          worktreePath: "/tmp/missing",
          sessionName: "pidesk-thread-missing",
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
          sessionName: "pidesk-thread-live",
          status: "ready",
          lastError: null,
        },
        {
          threadId: "thread-missing",
          worktreePath: "/tmp/missing",
          sessionName: "pidesk-thread-missing",
          status: "exited",
          lastError: null,
        },
      ],
      missingThreadIds: ["thread-missing"],
      staleSessionNames: ["pidesk-thread-stale"],
    });
  });
});
