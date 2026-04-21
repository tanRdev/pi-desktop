// @vitest-environment jsdom
import {
  createEmptyWorkspaceSession,
  type WorkspaceSession,
} from "@pi-desktop/shared";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_RECOVERY_STORAGE_KEY,
  type StorageLike,
} from "./session-recovery";
import { useSessionRecovery } from "./use-session-recovery";

function createMemoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k) => (data.has(k) ? (data.get(k) ?? null) : null),
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

function makeSession(): WorkspaceSession {
  return createEmptyWorkspaceSession("wt-hook");
}

vi.mock("@/lib/toast", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("useSessionRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows recovery toast on mount when recoverable session exists", async () => {
    const storage = createMemoryStorage();
    const session = makeSession();
    const { toast } = await import("@/lib/toast");
    storage.setItem(
      SESSION_RECOVERY_STORAGE_KEY,
      JSON.stringify([
        {
          recoverySchemaVersion: 1,
          schemaVersion: 2,
          timestamp: 1_000_000,
          session,
        },
      ]),
    );
    renderHook(() =>
      useSessionRecovery({
        storage,
        getSessionSnapshot: () => session,
        autoSaveIntervalMs: 0,
      }),
    );
    expect(toast.info).toHaveBeenCalledWith(
      "Previous session recovered",
      expect.objectContaining({ duration: 4000 }),
    );
  });

  it("does not show toast when no recoverable session exists", async () => {
    const storage = createMemoryStorage();
    const session = makeSession();
    const { toast } = await import("@/lib/toast");
    renderHook(() =>
      useSessionRecovery({
        storage,
        getSessionSnapshot: () => session,
        autoSaveIntervalMs: 0,
      }),
    );
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("auto-saves checkpoints on interval", () => {
    vi.useFakeTimers();
    try {
      const storage = createMemoryStorage();
      const session = makeSession();
      renderHook(() =>
        useSessionRecovery({
          storage,
          getSessionSnapshot: () => session,
          autoSaveIntervalMs: 1000,
          now: () => Date.now(),
        }),
      );
      expect(storage.getItem(SESSION_RECOVERY_STORAGE_KEY)).toBeNull();
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      const stored = storage.getItem(SESSION_RECOVERY_STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? "[]");
      expect(parsed.length).toBeGreaterThanOrEqual(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns isRecovering state and lastCheckpointTime", () => {
    const storage = createMemoryStorage();
    const session = makeSession();
    storage.setItem(
      SESSION_RECOVERY_STORAGE_KEY,
      JSON.stringify([
        {
          recoverySchemaVersion: 1,
          schemaVersion: 2,
          timestamp: 42,
          session,
        },
      ]),
    );
    const { result } = renderHook(() =>
      useSessionRecovery({
        storage,
        getSessionSnapshot: () => session,
        autoSaveIntervalMs: 0,
      }),
    );
    expect(result.current.lastCheckpointTime).toBe(42);
    expect(typeof result.current.isRecovering).toBe("boolean");
    expect(result.current.recovery).toBeDefined();
  });
});
