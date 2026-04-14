import { Effect, Logger } from "effect";

// Use the pretty logger from Effect
export const PiDesktopLoggerLive = Logger.replace(
  Logger.defaultLogger,
  Logger.prettyLogger(),
);

// Create a scoped logger for specific modules
export const createModuleLogger = (moduleName: string) => ({
  info: (message: string) => Effect.log(`[${moduleName}] ${message}`),
  error: (message: string, error?: unknown) =>
    Effect.logError(`[${moduleName}] ${message}${error ? `: ${error}` : ""}`),
  warn: (message: string) => Effect.logWarning(`[${moduleName}] ${message}`),
  debug: (message: string) => Effect.logDebug(`[${moduleName}] ${message}`),
});
