import { Effect, Layer, Logger, LogLevel } from "effect";

// Configure logger with timestamp and level
const loggerLayer = Logger.replace(
  Logger.defaultLogger,
  Logger.make(({ date, logLevel, message }) => {
    const timestamp = date.toISOString();
    const level = logLevel.label.padEnd(5);
    console.log(`[${timestamp}] [${level}] ${message}`);
  }),
);

// Default runtime with logger
export const PiDeskLive = Layer.mergeAll(
  loggerLayer,
  Logger.minimumLogLevel(LogLevel.Info),
);

// Helper to run effects with the default runtime
export const runEffect = <A, E>(effect: Effect.Effect<A, E>) => {
  return Effect.runPromise(effect.pipe(Effect.provide(PiDeskLive)));
};

// Helper to run effects that don't return (fire and forget with error logging)
export const runEffectVoid = <E>(effect: Effect.Effect<void, E>) => {
  Effect.runFork(
    effect.pipe(
      Effect.provide(PiDeskLive),
      Effect.tapError((error) =>
        Effect.sync(() => console.error("Effect failed:", error)),
      ),
    ),
  );
};
