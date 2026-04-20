/**
 * Log level primitives shared between main and renderer processes.
 *
 * Kept dependency-free so it can be imported from anywhere (including
 * preload scripts and tests).
 */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export const LOG_LEVELS: readonly LogLevel[] = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
] as const;

const RANK: Readonly<Record<LogLevel, number>> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

export function logLevelRank(level: LogLevel): number {
  return RANK[level];
}

/**
 * Returns true if an event at `level` should be emitted when the
 * configured minimum is `minimum`.
 */
export function shouldLog(level: LogLevel, minimum: LogLevel): boolean {
  return RANK[level] >= RANK[minimum];
}

export function isLogLevel(value: unknown): value is LogLevel {
  return (
    typeof value === "string" &&
    (value === "trace" ||
      value === "debug" ||
      value === "info" ||
      value === "warn" ||
      value === "error")
  );
}

/**
 * Parses a log level from arbitrary user input (env var, preference).
 * Returns `fallback` when the input is unrecognized.
 */
export function parseLogLevel(
  value: unknown,
  fallback: LogLevel = "info",
): LogLevel {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (isLogLevel(normalized)) return normalized;
  return fallback;
}
