import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import {
  mkdir,
  open as openAsync,
  rename as renameAsync,
  rm as rmAsync,
  stat as statAsync,
} from "node:fs/promises";
import path from "node:path";
import { Data, Effect, type Scope } from "effect";
import { runEffect } from "./effect/runtime";

export class PersistentJsonFileError extends Data.TaggedError(
  "PersistentJsonFileError",
)<{
  readonly message: string;
  readonly path: string;
  readonly cause?: unknown;
}> {}

export interface PersistentJsonFileOptions<T> {
  filePath: string;
  defaultValue: T;
  /**
   * Optional type guard. When provided, loaded content that fails validation
   * is treated as corrupt and we fall through to the backup / defaults chain.
   */
  validate?: (raw: unknown) => raw is T;
  /**
   * Debounce window (ms) before a coalesced write is flushed to disk.
   * Defaults to 50ms. Set to 0 to write synchronously on every `set`.
   */
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 50;

function resolveDefaultDebounceMs(): number {
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    return 0;
  }
  return DEFAULT_DEBOUNCE_MS;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function tryRemoveSync(filePath: string): void {
  try {
    rmSync(filePath, { force: true });
  } catch {
    // best-effort cleanup
  }
}

const tryRemoveAsyncEffect = (filePath: string): Effect.Effect<void, never> =>
  Effect.catchAll(
    Effect.tryPromise(() => rmAsync(filePath, { force: true })),
    () => Effect.void,
  );

function tryReadJson<T>(
  filePath: string,
  validate?: (raw: unknown) => raw is T,
): T | undefined {
  try {
    const content = readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(content);
    if (validate && !validate(parsed)) {
      return undefined;
    }
    return parsed as T;
  } catch {
    return undefined;
  }
}

const _tryReadJsonEffect = <T>(
  filePath: string,
  validate?: (raw: unknown) => raw is T,
): Effect.Effect<T | undefined, never> =>
  Effect.gen(function* () {
    const content: string | undefined = yield* Effect.catchAll(
      Effect.sync(() => readFileSync(filePath, "utf8")),
      () => Effect.succeed(undefined),
    );
    if (content === undefined) return undefined;
    const parsed: unknown = yield* Effect.catchAll(
      Effect.sync(() => JSON.parse(content) as unknown),
      () => Effect.succeed(undefined),
    );
    if (parsed === undefined) return undefined;
    if (validate && !validate(parsed)) return undefined;
    return parsed as T;
  });

const fileHandleResource = (
  tempPath: string,
  serialized: string,
): Effect.Effect<void, PersistentJsonFileError, Scope.Scope> =>
  Effect.gen(function* () {
    const handle = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => openAsync(tempPath, "w"),
        catch: (e) =>
          new PersistentJsonFileError({
            message: "Failed to open temp file",
            path: tempPath,
            cause: e,
          }),
      }),
      (handle) =>
        Effect.catchAll(
          Effect.tryPromise(() => handle.close()),
          () => Effect.void,
        ),
    );
    yield* Effect.tryPromise({
      try: () => handle.writeFile(serialized),
      catch: (e) =>
        new PersistentJsonFileError({
          message: "Failed to write temp file",
          path: tempPath,
          cause: e,
        }),
    });
    yield* Effect.catchAll(
      Effect.tryPromise(() => handle.sync()),
      () => Effect.void,
    );
  });

const backupPrimaryEffect = (
  filePath: string,
  backupPath: string,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const exists = yield* Effect.match(
      Effect.tryPromise(() => statAsync(filePath)),
      {
        onFailure: () => false,
        onSuccess: () => true,
      },
    );
    if (!exists) return;
    yield* Effect.catchAll(
      Effect.tryPromise(() => renameAsync(filePath, backupPath)),
      () => Effect.void,
    );
  });

const renamePrimaryEffect = (
  tempPath: string,
  filePath: string,
): Effect.Effect<void, PersistentJsonFileError> =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => renameAsync(tempPath, filePath),
      catch: (e) =>
        new PersistentJsonFileError({
          message: "Failed to rename temp file to primary",
          path: filePath,
          cause: e,
        }),
    });
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* tryRemoveAsyncEffect(tempPath);
        yield* Effect.fail(error);
      }),
    ),
  );

const saveAsyncEffect = <T>(
  filePath: string,
  backupPath: string,
  tempPath: string,
  nextValue: T,
): Effect.Effect<void, PersistentJsonFileError> =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => mkdir(path.dirname(filePath), { recursive: true }),
      catch: (e) =>
        new PersistentJsonFileError({
          message: "Failed to create directory",
          path: filePath,
          cause: e,
        }),
    });
    const serialized = `${JSON.stringify(nextValue, null, 2)}\n`;
    yield* Effect.scoped(fileHandleResource(tempPath, serialized));
    yield* backupPrimaryEffect(filePath, backupPath);
    yield* renamePrimaryEffect(tempPath, filePath);
  });

// Module-level registry so shutdown hooks can flush every live instance.
const LIVE_INSTANCES = new Set<PersistentJsonFile<unknown>>();

export async function flushAllPersistentJsonFiles(): Promise<void> {
  await Promise.all(Array.from(LIVE_INSTANCES).map((i) => i.flush()));
}

/**
 * Small file-backed JSON store with durability guarantees:
 *   - writes go to `<path>.tmp`, are fsynced, then renamed over the target
 *   - the previous good content is preserved as `<path>.bak`
 *   - corrupted primary content transparently falls back to the backup,
 *     then to the caller-supplied `defaultValue`
 *   - an `.tmp` left over from a crash is removed at next open
 *   - writes are coalesced: rapid `set` calls debounce to a single async
 *     write, serialized per-instance, with `flush()` to force completion
 */
export class PersistentJsonFile<T> {
  private value: T;
  private readonly debounceMs: number;
  private pendingValue: T | undefined;
  private pendingTimer: NodeJS.Timeout | undefined;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly options: PersistentJsonFileOptions<T>) {
    this.debounceMs = options.debounceMs ?? resolveDefaultDebounceMs();
    this.cleanupStrayTemp();
    this.value = this.load();
    LIVE_INSTANCES.add(this as PersistentJsonFile<unknown>);
  }

  get(): T {
    return clone(this.value);
  }

  set(nextValue: T): T {
    const cloned = clone(nextValue);
    this.value = cloned;
    this.scheduleWrite(cloned);
    return this.get();
  }

  update(updater: (value: T) => T): T {
    return this.set(updater(this.get()));
  }

  async flush(): Promise<void> {
    if (this.pendingTimer !== undefined) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = undefined;
      const toWrite = this.pendingValue;
      this.pendingValue = undefined;
      if (toWrite !== undefined) {
        this.enqueueWrite(toWrite);
      }
    }
    await this.writeChain;
  }

  private scheduleWrite(nextValue: T): void {
    this.pendingValue = nextValue;
    if (this.debounceMs <= 0) {
      this.pendingValue = undefined;
      this.saveSync(nextValue);
      return;
    }
    if (this.pendingTimer !== undefined) {
      return;
    }
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = undefined;
      const toWrite = this.pendingValue;
      this.pendingValue = undefined;
      if (toWrite !== undefined) {
        this.enqueueWrite(toWrite);
      }
    }, this.debounceMs);
  }

  private enqueueWrite(nextValue: T): void {
    this.writeChain = this.writeChain
      .catch(() => undefined)
      .then(() => this.saveAsync(nextValue));
  }

  private tempPath(): string {
    return `${this.options.filePath}.tmp`;
  }

  private backupPath(): string {
    return `${this.options.filePath}.bak`;
  }

  private cleanupStrayTemp(): void {
    if (existsSync(this.tempPath())) {
      tryRemoveSync(this.tempPath());
    }
  }

  private load(): T {
    const primary = tryReadJson<T>(
      this.options.filePath,
      this.options.validate,
    );
    if (primary !== undefined) {
      return clone(primary);
    }

    const backup = tryReadJson<T>(this.backupPath(), this.options.validate);
    if (backup !== undefined) {
      return clone(backup);
    }

    return clone(this.options.defaultValue);
  }

  private async saveAsync(nextValue: T): Promise<void> {
    await runEffect(
      saveAsyncEffect(
        this.options.filePath,
        this.backupPath(),
        this.tempPath(),
        nextValue,
      ),
    );
  }

  /**
   * Synchronous save kept for emergency/shutdown paths where a sync write is
   * required. Not used by the normal coalesced path.
   */
  private saveSync(nextValue: T): void {
    mkdirSync(path.dirname(this.options.filePath), { recursive: true });
    const tempPath = this.tempPath();
    const serialized = `${JSON.stringify(nextValue, null, 2)}\n`;

    const fd = openSync(tempPath, "w");
    try {
      writeSync(fd, serialized);
      try {
        fsyncSync(fd);
      } catch {
        // fsync may not be supported on some filesystems; proceed anyway.
      }
    } finally {
      closeSync(fd);
    }

    if (existsSync(this.options.filePath)) {
      try {
        renameSync(this.options.filePath, this.backupPath());
      } catch {
        // best-effort
      }
    }

    try {
      renameSync(tempPath, this.options.filePath);
    } catch (error) {
      tryRemoveSync(tempPath);
      throw error;
    }
  }
}
