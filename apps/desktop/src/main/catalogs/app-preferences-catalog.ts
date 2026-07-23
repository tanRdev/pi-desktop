import path from "node:path";
import {
  type AppPreferences,
  DocumentCatalog,
  type VersionedEnvelope,
  wrapEnvelope,
} from "@pi-desktop/shared";
import { PersistentJsonFile } from "./persistent-json-file";
import { recoverCorruptFile } from "./recover-corrupt-file";
import {
  createVersionedDocumentStore,
  validateVersionedDocument,
} from "./versioned-document-store";

const CURRENT_VERSION = 1;
const CATALOG_NAME = "app-preferences-catalog";

type AppPreferencesEnvelope = VersionedEnvelope<AppPreferences>;

const DEFAULT_PREFERENCES: AppPreferences = {};

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
  const provider = value.provider;
  const model = value.model;
  const providerOk =
    provider === undefined || provider === null || typeof provider === "string";
  const modelOk =
    model === undefined || model === null || typeof model === "string";
  return providerOk && modelOk;
}

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
  const favoriteModels =
    updates.favoriteModels === undefined
      ? current.favoriteModels
      : updates.favoriteModels;

  return {
    ...(leftSidebarWidth === undefined ? {} : { leftSidebarWidth }),
    ...(nextAi === undefined ? {} : { ai: nextAi }),
    ...(favoriteModels === undefined ? {} : { favoriteModels }),
  };
}

export class AppPreferencesCatalog {
  private readonly catalog: DocumentCatalog<
    AppPreferencesEnvelope,
    AppPreferences,
    Partial<AppPreferences>
  >;

  constructor(userDataPath: string) {
    const filePath = path.join(userDataPath, "catalog", "app-preferences.json");

    recoverCorruptFile(filePath, CATALOG_NAME, {
      currentVersion: CURRENT_VERSION,
      decode: decodeAppPreferences,
    });

    const file = new PersistentJsonFile<unknown>({
      filePath,
      defaultValue: wrapEnvelope(DEFAULT_PREFERENCES, CURRENT_VERSION),
      validate: (raw): raw is unknown =>
        validateVersionedDocument(raw, decodeAppPreferences),
    });

    const store = createVersionedDocumentStore(file, {
      currentVersion: CURRENT_VERSION,
      defaultData: DEFAULT_PREFERENCES,
      decode: decodeAppPreferences,
    });

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
