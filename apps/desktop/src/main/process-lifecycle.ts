import type { ChildProcess } from "node:child_process";

/**
 * Grace period in milliseconds between SIGTERM and SIGKILL.
 * Long enough for a well-behaved child to flush and exit cleanly,
 * short enough that a wedged child does not leak through shutdown.
 */
export const DEFAULT_TERMINATE_GRACE_MS = 5_000;

export interface TerminableChild {
  kill(signal?: NodeJS.Signals | number): boolean;
  readonly exitCode: number | null;
  readonly signalCode: NodeJS.Signals | null;
  once(event: "exit", listener: () => void): unknown;
  removeListener?(event: "exit", listener: () => void): unknown;
}

function hasActuallyExited(child: TerminableChild): boolean {
  // `child.killed` just means "a signal was sent" — it does NOT imply the
  // process has actually terminated. Only exitCode / signalCode confirm exit.
  return child.exitCode !== null || child.signalCode !== null;
}

/**
 * Send SIGTERM, wait up to `graceMs`, then SIGKILL if the child has not exited.
 * Safe to call if the child has already exited. Resolves when the child is gone
 * or when the grace period plus a short tail has elapsed.
 */
export function terminateChildWithEscalation(
  child: TerminableChild,
  graceMs: number = DEFAULT_TERMINATE_GRACE_MS,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (hasActuallyExited(child)) {
      resolve();
      return;
    }

    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    let hardTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (graceTimer) clearTimeout(graceTimer);
      if (hardTimer) clearTimeout(hardTimer);
      child.removeListener?.("exit", onExit);
      resolve();
    };

    const onExit = () => finish();
    child.once("exit", onExit);

    graceTimer = setTimeout(() => {
      if (!hasActuallyExited(child)) {
        try {
          child.kill("SIGKILL");
        } catch {
          /* child may have exited in the race */
        }
      }
      // Hard deadline: if the OS never delivers exit, stop waiting.
      hardTimer = setTimeout(finish, 5_000);
    }, graceMs);

    try {
      child.kill("SIGTERM");
    } catch {
      finish();
    }
  });
}

/** Narrow a Node `ChildProcess` to the minimal `TerminableChild` surface. */
export function asTerminableChild(child: ChildProcess): TerminableChild {
  return child;
}
