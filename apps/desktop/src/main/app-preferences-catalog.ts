import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  type AppPreferences,
  DocumentCatalog,
  type DocumentCatalogStore,
  decodeVersionedEnvelope,
  type VersionedEnvelope,
  wrapEnvelope,
} from "@pi-desktop/shared";
import { PersistentJsonFile } from "./persistent-json-file";

const CURRENT_VERSION = 1;

type AppPreferencesEnvelope = VersionedEnvelope<AppPreferences>;

const DEFAULT_PREFERENCES: AppPreferences = {};

const DEFAULT_ENVELOPE: AppPreferencesEnvelope = {
  schemaVersion: CURRENT_VERSION,
  data: DEFAULT_PREFERENCES,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalNumberOrNull(
  value: unknown,
): value is number | null | undefined {
  return value === undefined || value === null || typeof value === "number";
}

function isStringArrayOrNull(
  value: unknown,
): value is string[] | null | undefined {
  if (value === undefined || value === null) return true;
  if (!Array.isArray(value)) return false;
  return value.every((entry) => typeof entry === "string");
}

function isAiPreferences(value: unknown): value is AppPreferences["ai"] {
  if (value === undefined || value === null) return true;
  if (!isRecord(value)) return false;
  // provider/model are optional strings (or null)
  const provider = value.provider;
  const model = value.model;
  const providerOk =
    provider === undefined || provider === null || typeof provider === "string";
  const modelOk =
    model === undefined || model === null || typeof model === "string";
  return providerOk && modelOk;
}

/**
 * Pure decoder for `AppPreferences`. Returns the validated value or `null`
 * on failure. No `as` casts — every field is checked via type predicates.
 */
export function decodeAppPreferences(raw: unknown): AppPreferences | null {
  if (!isRecord(raw)) return null;

  const leftSidebarWidth = raw.leftSidebarWidth;
  const ai = raw.ai;
  const favoriteModels = raw.favoriteModels;

  if (!isOptionalNumberOrNull(leftSidebarWidth)) return null;
  if (!isAiPreferences(ai)) return null;
  if (!isStringArrayOrNull(favoriteModels)) return null;

  const result: AppPreferences = {};
  if (leftSidebarWidth !== undefined) {
    result.leftSidebarWidth = leftSidebarWidth;
  }
  if (ai !== undefined) {
    result.ai = ai;
  }
  if (favoriteModels !== undefined) {
    result.favoriteModels = favoriteModels;
  }
  return result;
}

function mergeAiPreferences(
  current: AppPreferences["ai"],
  updates: AppPreferences["ai"],
): AppPreferences["ai"] | undefined {
  if (updates === undefined) {
    return current;
  }

  if (updates === null) {
    return null;
  }

  const currentRecord = isRecord(current) ? current : {};
  const updateRecord = isRecord(updates) ? updates : {};
  const provider =
    typeof updateRecord.provider === "string"
      ? updateRecord.provider
      : typeof currentRecord.provider === "string"
        ? currentRecord.provider
        : undefined;
  const model =
    typeof updateRecord.model === "string"
      ? updateRecord.model
      : typeof currentRecord.model === "string"
        ? currentRecord.model
        : undefined;

  return {
    ...(provider === undefined ? {} : { provider }),
    ...(model === undefined ? {} : { model }),
  };
}

function mergeAppPreferences(
  current: AppPreferences,
  updates: Partial<AppPreferences>,
): AppPreferences {
  const nextAi = mergeAiPreferences(current.ai, updates.ai);
  const leftSidebarWidth =
    updates.leftSidebarWidth === undefined
      ? current.leftSidebarWidth
      : updates.leftSidebarWidth;

  return {
    ...(leftSidebarWidth === undefined ? {} : { leftSidebarWidth }),
    ...(nextAi === undefined ? {} : { ai: nextAi }),
  };
}

/**
 * Pre-load step: if the primary file exists but is unparseable or fails
 * envelope decoding, rename it to `<path>.corrupt-<ms>.json` and emit a
 * stderr warning. Leaves a missing primary untouched so downstream logic
 * falls back to defaults.
 */
function recoverCorruptFile(filePath: string): void {
  if (!existsSync(filePath)) return;

  let rawText: string;
  try {
    rawText = readFileSync(filePath, "utf8");
  } catch {
    return; // can't read; leave alone
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    quarantine(filePath, rawText, "unparseable JSON");
    return;
  }

  const result = decodeVersionedEnvelope<AppPreferences>(parsed, {
    currentVersion: CURRENT_VERSION,
    decode: decodeAppPreferences,
  });

  if (!result.ok) {
    quarantine(filePath, rawText, `envelope decode failed: ${result.reason}`);
  }
}

function quarantine(filePath: string, rawText: string, reason: string): void {
  const siblingPath = `${filePath}.corrupt-${Date.now()}.json`;
  try {
    // Prefer atomic rename so the primary slot is freed for PersistentJsonFile
    // to fall back to defaults. If rename is unavailable (e.g. the file was
    // deleted between stat and rename), fall back to a copy.
    try {
      renameSync(filePath, siblingPath);
    } catch {
      writeFileSync(siblingPath, rawText, "utf8");
    }
  } catch {
    // best-effort — if we cannot back up, still warn
  }
  process.stderr.write(
    `[app-preferences-catalog] corrupt preferences file quarantined at ${siblingPath} (${reason})\n`,
  );
}

/**
 * Store adapter that guarantees the in-memory document is always an
 * envelope with `schemaVersion === CURRENT_VERSION`, regardless of whether
 * the on-disk file was legacy (plain `AppPreferences`) or already enveloped.
 * The file is rewritten in the envelope shape on the next save.
 */
class AppPreferencesStore
  implements DocumentCatalogStore<AppPreferencesEnvelope>
{
  constructor(private readonly file: PersistentJsonFile<unknown>) {}

  get(): AppPreferencesEnvelope {
    return this.normalize(this.file.get());
  }

  update(
    updater: (document: AppPreferencesEnvelope) => AppPreferencesEnvelope,
  ): AppPreferencesEnvelope {
    const next = updater(this.get());
    this.file.set(next);
    return next;
  }

  private normalize(raw: unknown): AppPreferencesEnvelope {
    const result = decodeVersionedEnvelope<AppPreferences>(raw, {
      currentVersion: CURRENT_VERSION,
      decode: decodeAppPreferences,
    });
    if (result.ok) {
      return wrapEnvelope(result.data, CURRENT_VERSION);
    }
    return wrapEnvelope(DEFAULT_PREFERENCES, CURRENT_VERSION);
  }
}

/**
 * Accepts legacy plain-object preferences OR the envelope shape. Anything
 * else is treated as invalid and triggers `PersistentJsonFile`'s backup /
 * default fallback chain.
 */
function validatePersistedAppPreferences(raw: unknown): raw is unknown {
  if (!isRecord(raw)) return false;

  // Envelope shape
  if (typeof raw.schemaVersion === "number") {
    return decodeAppPreferences(raw.data) !== null;
  }

  // Legacy plain shape
  return decodeAppPreferences(raw) !== null;
}

export class AppPreferencesCatalog {
  private readonly catalog: DocumentCatalog<
    AppPreferencesEnvelope,
    AppPreferences,
    Partial<AppPreferences>
  >;

  constructor(userDataPath: string) {
    const filePath = path.join(userDataPath, "catalog", "app-preferences.json");

    // Quarantine corrupt files before PersistentJsonFile opens them, so the
    // writable primary slot is free for defaults.
    recoverCorruptFile(filePath);

    const file = new PersistentJsonFile<unknown>({
      filePath,
      defaultValue: DEFAULT_ENVELOPE,
      validate: validatePersistedAppPreferences,
    });

    const store = new AppPreferencesStore(file);

    this.catalog = new DocumentCatalog<
      AppPreferencesEnvelope,
      AppPreferences,
      Partial<AppPreferences>
    >({
      store,
      select: (document) => document.data,
      applyUpdate: (document, updates) => ({
        schemaVersion: CURRENT_VERSION,
        data: mergeAppPreferences(document.data, updates),
      }),
    });
  }

  get(): AppPreferences {
    return this.catalog.get();
  }

  update(updates: Partial<AppPreferences>): AppPreferences {
    return this.catalog.update(updates);
  }
}
