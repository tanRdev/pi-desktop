import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface PersistentJsonFileOptions<T> {
  filePath: string;
  defaultValue: T;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class PersistentJsonFile<T> {
  private value: T;

  constructor(private readonly options: PersistentJsonFileOptions<T>) {
    this.value = this.load();
  }

  get(): T {
    return clone(this.value);
  }

  set(nextValue: T): T {
    this.value = clone(nextValue);
    this.save();
    return this.get();
  }

  update(updater: (value: T) => T): T {
    return this.set(updater(this.get()));
  }

  private load(): T {
    if (!existsSync(this.options.filePath)) {
      return clone(this.options.defaultValue);
    }

    try {
      const content = readFileSync(this.options.filePath, "utf8");
      return clone(JSON.parse(content) as T);
    } catch {
      return clone(this.options.defaultValue);
    }
  }

  private save(): void {
    mkdirSync(path.dirname(this.options.filePath), { recursive: true });
    writeFileSync(
      this.options.filePath,
      `${JSON.stringify(this.value, null, 2)}\n`,
    );
  }
}
