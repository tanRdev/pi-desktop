import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DocumentCatalog,
  type DocumentCatalogStore,
  decodeVersionedEnvelope,
} from "@pi-desktop/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppPreferencesCatalog } from "../../../apps/desktop/src/main/app-preferences-catalog";

type PreferencesDocument = {
  version: 1;
  preferences: {
    leftSidebarWidth?: number | null;
  };
};

class MemoryStore implements DocumentCatalogStore<PreferencesDocument> {
  constructor(private document: PreferencesDocument) {}

  get(): PreferencesDocument {
    return structuredClone(this.document);
  }

  update(
    updater: (document: PreferencesDocument) => PreferencesDocument,
  ): PreferencesDocument {
    this.document = updater(this.get());
    return this.get();
  }
}

describe("DocumentCatalog", () => {
  it("reads and updates a projected value inside a document store", () => {
    const store = new MemoryStore({
      version: 1,
      preferences: {
        leftSidebarWidth: 240,
      },
    });
    const catalog = new DocumentCatalog({
      store,
      select: (document) => document.preferences,
      applyUpdate: (
        document,
        updates: { leftSidebarWidth?: number | null },
      ) => ({
        ...document,
        preferences: {
          ...document.preferences,
          ...updates,
        },
      }),
    });

    expect(catalog.get()).toEqual({
      leftSidebarWidth: 240,
    });
    expect(catalog.update({ leftSidebarWidth: 320 })).toEqual({
      leftSidebarWidth: 320,
    });
    expect(store.get()).toEqual({
      version: 1,
      preferences: {
        leftSidebarWidth: 320,
      },
    });
  });
});

// ---------------------------------------------------------------------------
// Versioned envelope tests (see REFACTOR.md §5.1)
// ---------------------------------------------------------------------------

type SampleV1 = { count: number };
type SampleV2 = { count: number; label: string };

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = val;
  }
  return result;
}

const decodeSampleV1 = (raw: unknown): SampleV1 | null => {
  const record = toRecord(raw);
  if (!record) return null;
  if (typeof record.count !== "number") return null;
  return { count: record.count };
};

const decodeSampleV2 = (raw: unknown): SampleV2 | null => {
  const record = toRecord(raw);
  if (!record) return null;
  if (typeof record.count !== "number") return null;
  if (typeof record.label !== "string") return null;
  return { count: record.count, label: record.label };
};

describe("decodeVersionedEnvelope", () => {
  it("decodes an envelope at the current version", () => {
    const result = decodeVersionedEnvelope(
      { schemaVersion: 1, data: { count: 7 } },
      { currentVersion: 1, decode: decodeSampleV1 },
    );
    expect(result).toEqual({ ok: true, data: { count: 7 }, wasLegacy: false });
  });

  it("treats a legacy unversioned payload as v1", () => {
    const result = decodeVersionedEnvelope(
      { count: 3 },
      { currentVersion: 1, decode: decodeSampleV1 },
    );
    expect(result).toEqual({ ok: true, data: { count: 3 }, wasLegacy: true });
  });

  it("runs migrations from v1 to v2 in order", () => {
    const result = decodeVersionedEnvelope(
      { schemaVersion: 1, data: { count: 2 } },
      {
        currentVersion: 2,
        migrations: [
          {
            from: 1,
            to: 2,
            migrate: (old) => {
              const record = toRecord(old) ?? {};
              return { ...record, label: "auto" };
            },
          },
        ],
        decode: decodeSampleV2,
      },
    );
    expect(result).toEqual({
      ok: true,
      data: { count: 2, label: "auto" },
      wasLegacy: false,
    });
  });

  it("fails with missing-migration when a step is not provided", () => {
    const result = decodeVersionedEnvelope(
      { schemaVersion: 1, data: { count: 0 } },
      { currentVersion: 2, decode: decodeSampleV2 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing-migration");
  });

  it("fails with decode-failed when the payload does not validate", () => {
    const result = decodeVersionedEnvelope(
      { schemaVersion: 1, data: { count: "nope" } },
      { currentVersion: 1, decode: decodeSampleV1 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("decode-failed");
  });
});

// ---------------------------------------------------------------------------
// End-to-end envelope tests via AppPreferencesCatalog (file-backed)
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

function createUserDataPath(): string {
  const directory = mkdtempSync(
    path.join(tmpdir(), "pi-desktop-document-catalog-"),
  );
  tempDirs.push(directory);
  return directory;
}

function catalogFilePath(userDataPath: string): string {
  return path.join(userDataPath, "catalog", "app-preferences.json");
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("VersionedDocumentCatalog (envelope round-trip)", () => {
  it("writes the envelope shape on save and reads it back", async () => {
    const userDataPath = createUserDataPath();
    const catalog = new AppPreferencesCatalog(userDataPath);

    catalog.update({ leftSidebarWidth: 320 });

    // Flush any debounced write
    const { flushAllPersistentJsonFiles } = await import(
      "../../../apps/desktop/src/main/persistent-json-file"
    );
    await flushAllPersistentJsonFiles();

    const raw = readFileSync(catalogFilePath(userDataPath), "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed).toMatchObject({
      schemaVersion: 1,
      data: { leftSidebarWidth: 320 },
    });

    const reloaded = new AppPreferencesCatalog(userDataPath);
    expect(reloaded.get()).toEqual({ leftSidebarWidth: 320 });
  });

  it("loads a legacy unversioned file as v1 and rewrites it with an envelope on next save", async () => {
    const userDataPath = createUserDataPath();
    const filePath = catalogFilePath(userDataPath);
    // Write a legacy plain-object file (no schemaVersion)
    const fs = await import("node:fs");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify({ leftSidebarWidth: 180 }), "utf8");

    const catalog = new AppPreferencesCatalog(userDataPath);
    expect(catalog.get()).toEqual({ leftSidebarWidth: 180 });

    catalog.update({ leftSidebarWidth: 200 });

    const { flushAllPersistentJsonFiles } = await import(
      "../../../apps/desktop/src/main/persistent-json-file"
    );
    await flushAllPersistentJsonFiles();

    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    expect(parsed).toMatchObject({
      schemaVersion: 1,
      data: { leftSidebarWidth: 200 },
    });
  });

  it("quarantines a corrupt file, returns defaults, and warns on stderr", async () => {
    const userDataPath = createUserDataPath();
    const filePath = catalogFilePath(userDataPath);
    const fs = await import("node:fs");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, "{not valid json,,,", "utf8");

    const warn = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const catalog = new AppPreferencesCatalog(userDataPath);
    expect(catalog.get()).toEqual({});

    const siblings = readdirSync(path.dirname(filePath)).filter((entry) =>
      entry.startsWith("app-preferences.json.corrupt-"),
    );
    expect(siblings.length).toBe(1);

    const wrote = warn.mock.calls.map((call) => String(call[0])).join("");
    expect(wrote).toMatch(/corrupt preferences file quarantined/);

    warn.mockRestore();
  });

  it("quarantines a file whose envelope decoding fails", async () => {
    const userDataPath = createUserDataPath();
    const filePath = catalogFilePath(userDataPath);
    const fs = await import("node:fs");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    // Valid JSON, but leftSidebarWidth has wrong type — decoder rejects it.
    writeFileSync(
      filePath,
      JSON.stringify({ schemaVersion: 1, data: { leftSidebarWidth: "wide" } }),
      "utf8",
    );

    const warn = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const catalog = new AppPreferencesCatalog(userDataPath);
    expect(catalog.get()).toEqual({});

    warn.mockRestore();

    const siblings = readdirSync(path.dirname(filePath)).filter((entry) =>
      entry.startsWith("app-preferences.json.corrupt-"),
    );
    expect(siblings.length).toBe(1);
  });
});
