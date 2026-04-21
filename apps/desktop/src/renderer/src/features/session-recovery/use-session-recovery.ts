import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import {
  createSessionRecovery,
  type SessionRecovery,
  type SessionRecoveryOptions,
} from "./session-recovery";

export interface UseSessionRecoveryOptions extends SessionRecoveryOptions {
  getSessionSnapshot: () => unknown;
  onRecovered?: (
    checkpoint: import("./session-recovery").RecoveryCheckpoint,
  ) => void;
}

export interface UseSessionRecoveryResult {
  isRecovering: boolean;
  lastCheckpointTime: number | null;
  recovery: SessionRecovery;
}

export function useSessionRecovery(
  options: UseSessionRecoveryOptions,
): UseSessionRecoveryResult {
  const recoveryRef = useRef<SessionRecovery | null>(null);
  if (recoveryRef.current === null) {
    recoveryRef.current = createSessionRecovery(options);
  }
  const recovery = recoveryRef.current;

  const [isRecovering, setIsRecovering] = useState(false);
  const [lastCheckpointTime, setLastCheckpointTime] = useState<number | null>(
    () => {
      const cp = recovery.loadLastCheckpoint();
      return cp?.timestamp ?? null;
    },
  );

  const onRecoveredRef = useRef(options.onRecovered);
  onRecoveredRef.current = options.onRecovered;

  const getSessionSnapshotRef = useRef(options.getSessionSnapshot);
  getSessionSnapshotRef.current = options.getSessionSnapshot;

  useEffect(() => {
    if (recovery.hasRecoverableSession()) {
      setIsRecovering(true);
      toast.info("Previous session recovered", {
        duration: 4000,
      });
      const cp = recovery.loadLastCheckpoint();
      if (cp) {
        onRecoveredRef.current?.(cp);
      }
      setIsRecovering(false);
    }
  }, [recovery]);

  useEffect(() => {
    const intervalMs = recovery.getAutoSaveIntervalMs();
    if (intervalMs <= 0) return undefined;
    const handle = setInterval(() => {
      const snapshot = getSessionSnapshotRef.current();
      if (
        snapshot &&
        typeof snapshot === "object" &&
        "worktreeId" in snapshot
      ) {
        recovery.saveCheckpoint(
          snapshot as import("@pi-desktop/shared").WorkspaceSession,
        );
        const cp = recovery.loadLastCheckpoint();
        if (cp) {
          setLastCheckpointTime(cp.timestamp);
        }
      }
    }, intervalMs);
    return () => clearInterval(handle);
  }, [recovery]);

  return { isRecovering, lastCheckpointTime, recovery };
}
