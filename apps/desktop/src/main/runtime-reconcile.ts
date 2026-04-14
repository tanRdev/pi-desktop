import type {
  ThreadRuntimeDescriptor,
  ThreadRuntimeReconcileReport,
} from "./thread-runtime-manager";

export interface ReconcileThreadRuntimeStatesInput {
  managedRuntimeIds: string[];
  threadStates: ThreadRuntimeDescriptor[];
}

export function reconcileThreadRuntimeStates({
  managedRuntimeIds,
  threadStates,
}: ReconcileThreadRuntimeStatesInput): ThreadRuntimeReconcileReport {
  const knownRuntimeIds = new Set(
    threadStates.map((thread) => thread.runtimeId),
  );

  return {
    active: threadStates,
    missingThreadIds: threadStates
      .filter((thread) => thread.status === "exited")
      .map((thread) => thread.threadId),
    staleRuntimeIds: managedRuntimeIds.filter(
      (runtimeId) => !knownRuntimeIds.has(runtimeId),
    ),
  };
}
