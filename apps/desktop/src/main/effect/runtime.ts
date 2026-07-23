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

/** Base logger Layer always present in main Effect runs. */
export const PiDesktopLive = Layer.mergeAll(
  loggerLayer,
  Logger.minimumLogLevel(LogLevel.Info),
);

type MainRuntimeLayer = Layer.Layer<never, never, never>;

let installedMainLayer: MainRuntimeLayer = PiDesktopLive as MainRuntimeLayer;

/**
 * Install the composed Desktop main Layer (catalogs, git, terminal, session).
 * After install, `runEffect` / `runEffectVoid` provide that graph — not logger-only theater.
 */
export function installDesktopMainRuntime(layer: MainRuntimeLayer): void {
  installedMainLayer = layer;
}

export function getDesktopMainRuntime(): MainRuntimeLayer {
  return installedMainLayer;
}

export function resetDesktopMainRuntimeForTests(): void {
  installedMainLayer = PiDesktopLive as MainRuntimeLayer;
}

export const runEffect = <A, E, R = never>(effect: Effect.Effect<A, E, R>) => {
  return Effect.runPromise(
    effect.pipe(Effect.provide(installedMainLayer as Layer.Layer<R>)),
  );
};

export const runEffectVoid = <E, R = never>(
  effect: Effect.Effect<void, E, R>,
) => {
  Effect.runFork(
    effect.pipe(
      Effect.provide(installedMainLayer as Layer.Layer<R>),
      Effect.tapError((error) =>
        Effect.sync(() => console.error("Effect failed:", error)),
      ),
    ),
  );
};
