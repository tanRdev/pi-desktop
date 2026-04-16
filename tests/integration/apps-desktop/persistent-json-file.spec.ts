import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PersistentJsonFile } from "../../../apps/desktop/src/main/persistent-json-file";

const tempDirs: string[] = [];

function createDir(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "pi-desktop-pjf-"));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

interface Doc {
  version: number;
  value: string;
}

const DEFAULT: Doc = { version: 1, value: "default" };

describe("PersistentJsonFile", () => {
  it("returns the default value when no file exists", () => {
    const dir = createDir();
    const store = new PersistentJsonFile<Doc>({
      filePath: path.join(dir, "doc.json"),
      defaultValue: DEFAULT,
    });
    expect(store.get()).toEqual(DEFAULT);
  });

  it("writes and reads back a value", () => {
    const dir = createDir();
    const filePath = path.join(dir, "nested", "doc.json");
    const store = new PersistentJsonFile<Doc>({
      filePath,
      defaultValue: DEFAULT,
    });
    store.set({ version: 2, value: "hello" });

    const reloaded = new PersistentJsonFile<Doc>({
      filePath,
      defaultValue: DEFAULT,
    });
    expect(reloaded.get()).toEqual({ version: 2, value: "hello" });
  });

  it("returns a defensive clone from get()", () => {
    const dir = createDir();
    const store = new PersistentJsonFile<Doc>({
      filePath: path.join(dir, "doc.json"),
      defaultValue: DEFAULT,
    });
    store.set({ version: 1, value: "a" });
    const first = store.get();
    first.value = "mutated";
    expect(store.get().value).toBe("a");
  });

  it("writes atomically via a temp file, never leaving partial state", () => {
    const dir = createDir();
    const filePath = path.join(dir, "doc.json");
    const store = new PersistentJsonFile<Doc>({
      filePath,
      defaultValue: DEFAULT,
    });
    store.set({ version: 3, value: "atomic" });

    // After success the temp file is gone and only the final file remains.
    const entries = readdirSync(dir);
    expect(entries).toContain("doc.json");
    expect(entries.filter((e) => e.endsWith(".tmp"))).toHaveLength(0);

    // Existing file should be valid JSON that round-trips.
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Doc;
    expect(parsed).toEqual({ version: 3, value: "atomic" });
  });

  it("recovers from a corrupted primary file using the .bak sidecar", () => {
    const dir = createDir();
    const filePath = path.join(dir, "doc.json");
    const store = new PersistentJsonFile<Doc>({
      filePath,
      defaultValue: DEFAULT,
    });
    store.set({ version: 1, value: "first" });
    store.set({ version: 2, value: "second" });

    // Corrupt the primary file.
    writeFileSync(filePath, "{ not json");

    const reloaded = new PersistentJsonFile<Doc>({
      filePath,
      defaultValue: DEFAULT,
    });
    // Backup contains the previous successful write.
    expect(reloaded.get()).toEqual({ version: 1, value: "first" });
  });

  it("falls back to defaults when both primary and backup are corrupted", () => {
    const dir = createDir();
    const filePath = path.join(dir, "doc.json");
    writeFileSync(filePath, "{ not json");
    writeFileSync(`${filePath}.bak`, "also not json");

    const store = new PersistentJsonFile<Doc>({
      filePath,
      defaultValue: DEFAULT,
    });
    expect(store.get()).toEqual(DEFAULT);
  });

  it("validates loaded content and falls back when validator rejects it", () => {
    const dir = createDir();
    const filePath = path.join(dir, "doc.json");
    writeFileSync(filePath, JSON.stringify({ version: 1, value: 42 }));

    const store = new PersistentJsonFile<Doc>({
      filePath,
      defaultValue: DEFAULT,
      validate: (raw): raw is Doc =>
        typeof raw === "object" &&
        raw !== null &&
        typeof (raw as { value?: unknown }).value === "string",
    });
    expect(store.get()).toEqual(DEFAULT);
  });

  it("cleans up stray temp file from a previous crashed write", () => {
    const dir = createDir();
    const filePath = path.join(dir, "doc.json");
    writeFileSync(`${filePath}.tmp`, '{"version":9,"value":"stray"}');

    const store = new PersistentJsonFile<Doc>({
      filePath,
      defaultValue: DEFAULT,
    });
    store.set({ version: 1, value: "fresh" });

    const entries = readdirSync(dir);
    expect(entries.filter((e) => e.endsWith(".tmp"))).toHaveLength(0);
    expect(existsSync(filePath)).toBe(true);
  });
});
