import { startTimer } from "@pi-desktop/shared";
import { useCallback, useSyncExternalStore } from "react";
import { globalPerfStore, type PerfEntry, type PerfStore } from "./perf-store";

export interface UsePerfTimerHandle {
  readonly stop: () => PerfEntry;
}

/**
 * Returns a function that starts a named timer. The returned `stop` records
 * the elapsed reading into the perf store and returns the entry.
 */
export function usePerf(store: PerfStore = globalPerfStore): {
  readonly start: (name: string) => UsePerfTimerHandle;
} {
  const start = useCallback(
    (name: string): UsePerfTimerHandle => {
      const handle = startTimer(name);
      return {
        stop(): PerfEntry {
          const result = handle.stop();
          const entry: PerfEntry = {
            name: result.name,
            ms: result.ms,
            ts: Date.now(),
          };
          store.push(entry);
          return entry;
        },
      };
    },
    [store],
  );

  return { start };
}

/**
 * Subscribe a component to the perf store. Returns the latest snapshot.
 * Uses `useSyncExternalStore` so React 18+ concurrent rendering stays
 * consistent across tearing.
 */
export function usePerfEntries(
  store: PerfStore = globalPerfStore,
): ReadonlyArray<PerfEntry> {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.snapshot(),
    () => store.snapshot(),
  );
}
