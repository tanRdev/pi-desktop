import {
  type DocumentCatalogStore,
  decodeVersionedEnvelope,
  type VersionedEnvelope,
  wrapEnvelope,
} from "@pi-desktop/shared";
import type { PersistentJsonFile } from "./persistent-json-file";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateVersionedDocument<TData>(
  raw: unknown,
  decode: (raw: unknown) => TData | null,
): raw is unknown {
  if (!isRecord(raw)) return false;

  if (typeof raw.schemaVersion === "number") {
    return decode(raw.data) !== null;
  }

  return decode(raw) !== null;
}

export function createVersionedDocumentStore<TData>(
  file: PersistentJsonFile<unknown>,
  options: {
    currentVersion: number;
    defaultData: TData;
    decode: (raw: unknown) => TData | null;
  },
): DocumentCatalogStore<VersionedEnvelope<TData>> {
  const defaultEnvelope = wrapEnvelope(
    options.defaultData,
    options.currentVersion,
  );

  const normalize = (raw: unknown): VersionedEnvelope<TData> => {
    const result = decodeVersionedEnvelope<TData>(raw, {
      currentVersion: options.currentVersion,
      decode: options.decode,
    });
    if (result.ok) {
      return wrapEnvelope(result.data, options.currentVersion);
    }
    return defaultEnvelope;
  };

  return {
    get(): VersionedEnvelope<TData> {
      return normalize(file.get());
    },
    update(
      updater: (document: VersionedEnvelope<TData>) => VersionedEnvelope<TData>,
    ): VersionedEnvelope<TData> {
      const next = updater(normalize(file.get()));
      file.set(next);
      return next;
    },
  };
}
