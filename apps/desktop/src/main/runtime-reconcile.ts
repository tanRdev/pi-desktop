import type {
  ThreadRuntimeDescriptor,
  ThreadRuntimeReconcileReport,
} from "./thread-runtime-manager";

export interface ReconcileThreadRuntimeStatesInput {
  managedSessionNames: string[];
  threadStates: ThreadRuntimeDescriptor[];
}

export function reconcileThreadRuntimeStates({
  managedSessionNames,
  threadStates,
}: ReconcileThreadRuntimeStatesInput): ThreadRuntimeReconcileReport {
  const knownSessionNames = new Set(
    threadStates.map((thread) => thread.sessionName),
  );

  return {
    active: threadStates,
    missingThreadIds: threadStates
      .filter((thread) => thread.status === "exited")
      .map((thread) => thread.threadId),
    staleSessionNames: managedSessionNames.filter(
      (sessionName) => !knownSessionNames.has(sessionName),
    ),
  };
}
