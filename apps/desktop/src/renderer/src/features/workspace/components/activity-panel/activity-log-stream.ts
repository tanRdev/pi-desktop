import type { LogEntry, LogLevel } from "@pi-desktop/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

const MAX_VISIBLE_ENTRIES = 200;

export interface ActivityLogStream {
  readonly entries: ReadonlyArray<LogEntry>;
  subscribe: (
    subscriber: (entries: ReadonlyArray<LogEntry>) => void,
  ) => () => void;
  push: (entry: LogEntry) => void;
  clear: () => void;
}

interface ActivityLogStreamOptions {
  maxEntries?: number;
  now?: () => number;
}

function createActivityLogStream(
  options: ActivityLogStreamOptions = {},
): ActivityLogStream {
  const maxEntries = options.maxEntries ?? MAX_VISIBLE_ENTRIES;

  const entries: LogEntry[] = [];
  const subscribers = new Set<(entries: ReadonlyArray<LogEntry>) => void>();

  function snapshot(): ReadonlyArray<LogEntry> {
    return entries.slice();
  }

  function notify(): void {
    const snap = snapshot();
    for (const sub of subscribers) sub(snap);
  }

  function push(entry: LogEntry): void {
    entries.push(entry);
    if (entries.length > maxEntries) {
      entries.splice(0, entries.length - maxEntries);
    }
    notify();
  }

  function clear(): void {
    if (entries.length === 0) return;
    entries.length = 0;
    notify();
  }

  function subscribe(
    subscriber: (entries: ReadonlyArray<LogEntry>) => void,
  ): () => void {
    subscribers.add(subscriber);
    subscriber(snapshot());
    return () => {
      subscribers.delete(subscriber);
    };
  }

  const stream: ActivityLogStream = {
    get entries() {
      return snapshot();
    },
    subscribe,
    push,
    clear,
  };
  return stream;
}

let globalStream: ActivityLogStream | undefined;

function getGlobalStream(): ActivityLogStream {
  if (!globalStream) {
    globalStream = createActivityLogStream();
  }
  return globalStream;
}

function isDevMode(): boolean {
  return typeof import.meta !== "undefined" && import.meta.env?.DEV === true;
}

function getPiDesktopOn(): {
  on: (event: string, handler: (entry: unknown) => void) => () => void;
} | null {
  const w = window;
  if (w == null) return null;
  if (!("piDesktop" in w)) return null;
  const pi = Reflect.get(w, "piDesktop");
  if (pi == null || typeof pi !== "object") return null;
  if (!("on" in pi)) return null;
  const onFn = Reflect.get(pi, "on");
  if (typeof onFn !== "function") return null;
  return { on: onFn.bind(pi) };
}

function setupIpcSubscription(stream: ActivityLogStream): () => void {
  const piDesktop = getPiDesktopOn();

  if (piDesktop) {
    const unsubscribe = piDesktop.on("logs:event", (entry: unknown) => {
      if (isLogEntry(entry)) {
        stream.push(entry);
      }
    });
    return unsubscribe;
  }

  if (!isDevMode()) return () => {};

  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  const origDebug = console.debug;
  const nowFn = Date.now;

  console.log = (...args: unknown[]) => {
    origLog.apply(console, args);
    stream.push(logEntryFromArgs("info", args, nowFn()));
  };
  console.warn = (...args: unknown[]) => {
    origWarn.apply(console, args);
    stream.push(logEntryFromArgs("warn", args, nowFn()));
  };
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    stream.push(logEntryFromArgs("error", args, nowFn()));
  };
  console.debug = (...args: unknown[]) => {
    origDebug.apply(console, args);
    stream.push(logEntryFromArgs("debug", args, nowFn()));
  };

  return () => {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
    console.debug = origDebug;
  };
}

function logEntryFromArgs(
  level: LogLevel,
  args: unknown[],
  ts: number,
): LogEntry {
  const message = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  return { ts, level, scope: "console", message };
}

const LOG_LEVELS_SET: ReadonlySet<string> = new Set([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
]);

function isLogEntry(value: unknown): value is LogEntry {
  if (typeof value !== "object" || value === null) return false;
  if (!("ts" in value)) return false;
  if (!("level" in value)) return false;
  if (!("scope" in value)) return false;
  if (!("message" in value)) return false;
  const rec = value;
  return (
    typeof rec.ts === "number" &&
    typeof rec.level === "string" &&
    LOG_LEVELS_SET.has(rec.level) &&
    typeof rec.scope === "string" &&
    typeof rec.message === "string"
  );
}

export interface UseActivityLogResult {
  entries: ReadonlyArray<LogEntry>;
  clear: () => void;
}

export function useActivityLog(
  stream: ActivityLogStream = getGlobalStream(),
): UseActivityLogResult {
  const [entries, setEntries] = useState<ReadonlyArray<LogEntry>>(() =>
    Array.isArray(stream.entries) ? stream.entries : [],
  );

  useEffect(() => {
    const unsubscribe = stream.subscribe(setEntries);
    return unsubscribe;
  }, [stream]);

  const clear = useCallback(() => stream.clear(), [stream]);

  return useMemo(() => ({ entries, clear }), [entries, clear]);
}

export {
  createActivityLogStream,
  getGlobalStream,
  setupIpcSubscription,
  MAX_VISIBLE_ENTRIES,
};
