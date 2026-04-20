export {
  isLogLevel,
  LOG_LEVELS,
  type LogLevel,
  logLevelRank,
  parseLogLevel,
  shouldLog,
} from "./log-levels.js";
export {
  measureAsync,
  measureSync,
  type PerfTimerHandle,
  type PerfTimerResult,
  startTimer,
} from "./perf-timer.js";
export { redact, redactString } from "./redaction.js";

export interface LogEntry {
  readonly ts: number;
  readonly level: import("./log-levels.js").LogLevel;
  readonly scope: string;
  readonly message: string;
  readonly data?: unknown;
}
