import { useCallback, useSyncExternalStore } from "react";
import type { BrailleSpinnerName, Spinner } from "unicode-animations";
import spinners from "unicode-animations";

/**
 * Cycles through unicode-animations braille spinner frames or custom frames.
 * Returns the current frame string. Only ticks while `active` is true.
 *
 * All active spinners with the same `interval` share a single setInterval, so
 * having many spinners on screen at once does not multiply timer callbacks.
 */
type Ticker = {
  index: number;
  subscribers: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
  interval: number;
};

const tickers = new Map<number, Ticker>();

function getTicker(interval: number): Ticker {
  let ticker = tickers.get(interval);
  if (!ticker) {
    ticker = { index: 0, subscribers: new Set(), timer: null, interval };
    tickers.set(interval, ticker);
  }
  return ticker;
}

function ensureRunning(ticker: Ticker) {
  if (ticker.timer !== null) return;
  ticker.timer = setInterval(() => {
    ticker.index = (ticker.index + 1) | 0;
    for (const notify of ticker.subscribers) {
      notify();
    }
  }, ticker.interval);
}

function maybeStop(ticker: Ticker) {
  if (ticker.subscribers.size === 0 && ticker.timer !== null) {
    clearInterval(ticker.timer);
    ticker.timer = null;
    // Keep `index` so that a quick resubscribe (e.g. React re-running subscribe
    // after a snapshot change) does not reset the frame back to 0 and cause
    // the UI to flicker back to the first frame.
  }
}

export function useUnicodeSpinner(
  spinnerOrName: BrailleSpinnerName | Spinner,
  active: boolean,
): string {
  const spinner =
    typeof spinnerOrName === "string" ? spinners[spinnerOrName] : spinnerOrName;
  const interval = spinner.interval;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!active) {
        return () => {};
      }
      const ticker = getTicker(interval);
      ticker.subscribers.add(onChange);
      ensureRunning(ticker);
      return () => {
        ticker.subscribers.delete(onChange);
        maybeStop(ticker);
      };
    },
    [active, interval],
  );

  const getSnapshot = useCallback(() => {
    if (!active) return 0;
    const ticker = tickers.get(interval);
    return ticker ? ticker.index : 0;
  }, [active, interval]);

  const index = useSyncExternalStore(subscribe, getSnapshot, () => 0);

  if (!active) {
    return spinner.frames[0] ?? "";
  }

  const framesLen = spinner.frames.length;
  return spinner.frames[((index % framesLen) + framesLen) % framesLen] ?? "";
}
