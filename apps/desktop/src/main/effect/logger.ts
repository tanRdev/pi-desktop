import {
  type LogEntry,
  type LogLevel,
  parseLogLevel,
  redact,
  redactString,
  shouldLog,
} from "@pi-desktop/shared";
import { Effect, Logger } from "effect";

/**
 * Structured, redacting logger for the Electron main process.
 *
 * Responsibilities:
 *  - Normalize every log event into a `LogEntry` ({ ts, level, scope,
 *    message, data? }).
 *  - Redact paths / tokens / emails from messages and structured data so
 *    log sinks (stdout, crash reports, devtools panel) never see secrets.
 *  - Keep an in-memory ring buffer of the last N entries for an
 *    observability panel exposed over IPC by A10/A11 wiring.
 *  - Honor a minimum level configured via env (`PI_LOG_LEVEL`) or an
 *    explicit preference, falling back to `"info"`.
 */

const RING_CAPACITY = 1000;

interface RingBufferState {
  readonly entries: LogEntry[];
  minimum: LogLevel;
}

function readEnvLogLevel(): LogLevel | undefined {
  const env: unknown = (globalThis as { process?: { env?: unknown } }).process
    ?.env;
  if (env === null || typeof env !== "object") return undefined;
  const record: Record<string, unknown> = Object.fromEntries(
    Object.entries(env),
  );
  const candidate = record.PI_LOG_LEVEL ?? record.LOG_LEVEL;
  if (typeof candidate !== "string") return undefined;
  return parseLogLevel(candidate);
}

const state: RingBufferState = {
  entries: [],
  minimum: readEnvLogLevel() ?? "info",
};

function pushEntry(entry: LogEntry): void {
  state.entries.push(entry);
  if (state.entries.length > RING_CAPACITY) {
    state.entries.splice(0, state.entries.length - RING_CAPACITY);
  }
}

/** Returns a defensive copy of the recent log buffer (oldest first). */
export function getRecentLogs(): readonly LogEntry[] {
  return state.entries.slice();
}

/** Clears the in-memory ring buffer. */
export function clearRecentLogs(): void {
  state.entries.length = 0;
}

/** Minimum log level currently in effect. */
export function getMinimumLogLevel(): LogLevel {
  return state.minimum;
}

/** Override the minimum log level (e.g. from a user preference). */
export function setMinimumLogLevel(level: LogLevel): void {
  state.minimum = level;
}

/** Ring-buffer capacity exposed for tests / UI. */
export const RING_BUFFER_CAPACITY = RING_CAPACITY;

function writeEntry(entry: LogEntry): void {
  pushEntry(entry);
  const data = entry.data === undefined ? "" : ` ${safeStringify(entry.data)}`;
  const line = `[${new Date(entry.ts).toISOString()}] [${entry.level.toUpperCase().padEnd(5)}] [${entry.scope}] ${entry.message}${data}`;
  switch (entry.level) {
    case "error":
      console.error(line);
      return;
    case "warn":
      console.warn(line);
      return;
    case "debug":
    case "trace":
      console.debug(line);
      return;
    default:
      console.log(line);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "<unserializable>";
  }
}

function record(
  level: LogLevel,
  scope: string,
  message: string,
  data?: unknown,
): void {
  if (!shouldLog(level, state.minimum)) return;
  const redactedData = data === undefined ? undefined : redact(data);
  const entry: LogEntry = {
    ts: Date.now(),
    level,
    scope,
    message: redactString(message),
    data: redactedData,
  };
  writeEntry(entry);
}

/**
 * Effect-aware module logger. Each method returns an `Effect<void>` so
 * existing call sites (`Effect.log`, etc.) stay idiomatic.
 */
export interface ModuleLogger {
  readonly trace: (message: string, data?: unknown) => Effect.Effect<void>;
  readonly debug: (message: string, data?: unknown) => Effect.Effect<void>;
  readonly info: (message: string, data?: unknown) => Effect.Effect<void>;
  readonly warn: (message: string, data?: unknown) => Effect.Effect<void>;
  readonly error: (message: string, error?: unknown) => Effect.Effect<void>;
}

export const createModuleLogger = (moduleName: string): ModuleLogger => ({
  trace: (message, data) =>
    Effect.sync(() => record("trace", moduleName, message, data)),
  debug: (message, data) =>
    Effect.sync(() => record("debug", moduleName, message, data)),
  info: (message, data) =>
    Effect.sync(() => record("info", moduleName, message, data)),
  warn: (message, data) =>
    Effect.sync(() => record("warn", moduleName, message, data)),
  error: (message, error) =>
    Effect.sync(() =>
      record(
        "error",
        moduleName,
        message,
        error === undefined ? undefined : { error },
      ),
    ),
});

/**
 * Effect Logger layer that funnels every `Effect.log*` call through our
 * structured + redacting pipeline. Installed by the desktop runtime.
 */
export const PiDesktopLoggerLive = Logger.replace(
  Logger.defaultLogger,
  Logger.make(({ date, logLevel, message }) => {
    const level = mapEffectLogLevel(logLevel.label);
    const text = Array.isArray(message)
      ? message
          .map((m) => (typeof m === "string" ? m : safeStringify(m)))
          .join(" ")
      : typeof message === "string"
        ? message
        : safeStringify(message);
    const entry: LogEntry = {
      ts: date.getTime(),
      level,
      scope: "effect",
      message: redactString(text),
    };
    if (!shouldLog(level, state.minimum)) return;
    writeEntry(entry);
  }),
);

function mapEffectLogLevel(label: string): LogLevel {
  const normalized = label.trim().toLowerCase();
  if (normalized === "fatal" || normalized === "error") return "error";
  if (normalized === "warn" || normalized === "warning") return "warn";
  if (normalized === "debug") return "debug";
  if (normalized === "trace" || normalized === "all") return "trace";
  return "info";
}
