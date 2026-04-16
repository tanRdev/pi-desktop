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

async function tryRemoveAsync(filePath: string): Promise<void> {
  try {
    await rmAsync(filePath, { force: true });
  } catch {
    // best-effort cleanup
  }
}

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
    // Without a validator we cannot soundly narrow `unknown` to `T`.
    // Callers opt into this by not passing a validator; we cast through
    // `unknown` here as an unavoidable trust boundary for legacy callers.
    return parsed as T;
  } catch {
    return undefined;
  }
}

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
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
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

  /**
   * Flush any pending coalesced write and wait for the disk write to finish.
   */
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
      this.enqueueWrite(nextValue);
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
    await mkdir(path.dirname(this.options.filePath), { recursive: true });
    const tempPath = this.tempPath();
    const serialized = `${JSON.stringify(nextValue, null, 2)}\n`;

    // Write to a temp file with an fsync so the payload is durable before we
    // expose it via rename.
    const handle = await openAsync(tempPath, "w");
    try {
      await handle.writeFile(serialized);
      try {
        await handle.sync();
      } catch {
        // fsync may not be supported on some filesystems; proceed anyway.
      }
    } finally {
      await handle.close();
    }

    // Preserve the previous successful write as a sidecar backup before
    // atomically replacing the primary file.
    let primaryExists = true;
    try {
      await statAsync(this.options.filePath);
    } catch {
      primaryExists = false;
    }
    if (primaryExists) {
      try {
        await renameAsync(this.options.filePath, this.backupPath());
      } catch {
        // If we can't move it aside, keep going; the rename below is still
        // atomic and won't produce partial data.
      }
    }

    try {
      await renameAsync(tempPath, this.options.filePath);
    } catch (error) {
      await tryRemoveAsync(tempPath);
      throw error;
    }
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
