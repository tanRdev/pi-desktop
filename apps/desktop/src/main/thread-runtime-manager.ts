import type { ThreadRuntimeStatus } from "@pi-desktop/shared";

export interface ThreadRuntimeRef {
  threadId: string;
  worktreePath: string;
}

export interface ThreadRuntimeLaunchSpec extends ThreadRuntimeRef {
  command: string[];
}

export interface ThreadRuntimeDescriptor extends ThreadRuntimeRef {
  runtimeId: string;
  status: ThreadRuntimeStatus;
  lastError: string | null;
}

export interface ThreadRuntimeReconcileReport {
  active: ThreadRuntimeDescriptor[];
  missingThreadIds: string[];
  staleRuntimeIds: string[];
}

export interface ThreadRuntimeManager {
  ensureThreadRuntime(
    spec: ThreadRuntimeLaunchSpec,
  ): Promise<ThreadRuntimeDescriptor>;
  getRuntimeState(thread: ThreadRuntimeRef): Promise<ThreadRuntimeDescriptor>;
  restartThreadRuntime(
    spec: ThreadRuntimeLaunchSpec,
  ): Promise<ThreadRuntimeDescriptor>;
  terminateThreadRuntime(threadId: string): Promise<void>;
  reconcile(threads: ThreadRuntimeRef[]): Promise<ThreadRuntimeReconcileReport>;
}
