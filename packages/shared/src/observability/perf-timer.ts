/**
 * High-resolution performance timers.
 *
 * Uses `performance.now()` when available (Electron main, renderer, jsdom),
 * otherwise falls back to `Date.now()`. Pure — does not allocate any
 * background resources.
 */

export interface PerfTimerResult {
  readonly name: string;
  readonly ms: number;
}

export interface PerfTimerHandle {
  readonly stop: () => PerfTimerResult;
}

function now(): number {
  const globalPerf: unknown = (globalThis as { performance?: unknown })
    .performance;
  if (
    globalPerf !== null &&
    typeof globalPerf === "object" &&
    "now" in globalPerf &&
    typeof (globalPerf as { now: unknown }).now === "function"
  ) {
    const fn = (globalPerf as { now: () => number }).now;
    return fn.call(globalPerf);
  }
  return Date.now();
}

/**
 * Start a timer. Call the returned `stop()` to get elapsed milliseconds.
 * The handle may be stopped multiple times; each call returns a fresh
 * reading against the original start.
 */
export function startTimer(name: string): PerfTimerHandle {
  const started = now();
  return {
    stop(): PerfTimerResult {
      return { name, ms: now() - started };
    },
  };
}

/**
 * Measure an async operation. Always resolves/rejects with the underlying
 * value, attaching the timing to the returned tuple.
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<{ result: T; timing: PerfTimerResult }> {
  const timer = startTimer(name);
  const result = await fn();
  return { result, timing: timer.stop() };
}

/** Measure a synchronous function. */
export function measureSync<T>(
  name: string,
  fn: () => T,
): { result: T; timing: PerfTimerResult } {
  const timer = startTimer(name);
  const result = fn();
  return { result, timing: timer.stop() };
}
