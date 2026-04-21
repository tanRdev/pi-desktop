import type { PerfTimerResult } from "@pi-desktop/shared";

/**
 * Recent timer entries kept in a fixed-size ring buffer.
 *
 * Subscribers are notified after every push. The store is process-wide so
 * timings recorded anywhere in the renderer flow into a single overlay.
 */

export interface PerfEntry extends PerfTimerResult {
  readonly ts: number;
}

export interface PerfStore {
  readonly push: (entry: PerfEntry) => void;
  readonly snapshot: () => ReadonlyArray<PerfEntry>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly clear: () => void;
  readonly capacity: number;
}

export const PERF_BUFFER_CAPACITY = 200;

export function createPerfStore(
  capacity: number = PERF_BUFFER_CAPACITY,
): PerfStore {
  if (capacity <= 0) {
    throw new Error("perf-store capacity must be positive");
  }
  const buffer: PerfEntry[] = [];
  const listeners = new Set<() => void>();
  let cachedSnapshot: ReadonlyArray<PerfEntry> = [];
  let snapshotDirty = false;

  function notify(): void {
    snapshotDirty = true;
    for (const l of listeners) l();
  }

  return {
    capacity,
    push(entry: PerfEntry): void {
      buffer.push(entry);
      if (buffer.length > capacity) {
        buffer.splice(0, buffer.length - capacity);
      }
      notify();
    },
    snapshot(): ReadonlyArray<PerfEntry> {
      if (snapshotDirty) {
        cachedSnapshot = buffer.slice();
        snapshotDirty = false;
      }
      return cachedSnapshot;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear(): void {
      buffer.length = 0;
      notify();
    },
  };
}

/** Module-level default store used by the overlay and use-perf hook. */
export const globalPerfStore: PerfStore = createPerfStore();
