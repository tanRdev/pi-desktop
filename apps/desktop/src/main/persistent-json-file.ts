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
import path from "node:path";

export interface PersistentJsonFileOptions<T> {
  filePath: string;
  defaultValue: T;
  /**
   * Optional type guard. When provided, loaded content that fails validation
   * is treated as corrupt and we fall through to the backup / defaults chain.
   */
  validate?: (raw: unknown) => raw is T;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function tryRemove(filePath: string): void {
  try {
    rmSync(filePath, { force: true });
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

/**
 * Small file-backed JSON store with durability guarantees:
 *   - writes go to `<path>.tmp`, are fsynced, then renamed over the target
 *   - the previous good content is preserved as `<path>.bak`
 *   - corrupted primary content transparently falls back to the backup,
 *     then to the caller-supplied `defaultValue`
 *   - an `.tmp` left over from a crash is removed at next open
 */
export class PersistentJsonFile<T> {
  private value: T;

  constructor(private readonly options: PersistentJsonFileOptions<T>) {
    this.cleanupStrayTemp();
    this.value = this.load();
  }

  get(): T {
    return clone(this.value);
  }

  set(nextValue: T): T {
    const cloned = clone(nextValue);
    this.save(cloned);
    this.value = cloned;
    return this.get();
  }

  update(updater: (value: T) => T): T {
    return this.set(updater(this.get()));
  }

  private tempPath(): string {
    return `${this.options.filePath}.tmp`;
  }

  private backupPath(): string {
    return `${this.options.filePath}.bak`;
  }

  private cleanupStrayTemp(): void {
    if (existsSync(this.tempPath())) {
      tryRemove(this.tempPath());
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

  private save(nextValue: T): void {
    mkdirSync(path.dirname(this.options.filePath), { recursive: true });
    const tempPath = this.tempPath();
    const serialized = `${JSON.stringify(nextValue, null, 2)}\n`;

    // Write to a temp file with an fsync so the payload is durable before we
    // expose it via rename.
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

    // Preserve the previous successful write as a sidecar backup before
    // atomically replacing the primary file.
    if (existsSync(this.options.filePath)) {
      try {
        renameSync(this.options.filePath, this.backupPath());
      } catch {
        // If we can't move it aside, keep going; the rename below is still
        // atomic and won't produce partial data.
      }
    }

    try {
      renameSync(tempPath, this.options.filePath);
    } catch (error) {
      tryRemove(tempPath);
      throw error;
    }
  }
}
