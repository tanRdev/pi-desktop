export interface DocumentCatalogStore<TDocument> {
  get(): TDocument;
  update(updater: (document: TDocument) => TDocument): TDocument;
}

export interface DocumentCatalogOptions<TDocument, TValue, TUpdate = TValue> {
  store: DocumentCatalogStore<TDocument>;
  select: (document: TDocument) => TValue;
  applyUpdate: (document: TDocument, update: TUpdate) => TDocument;
}

export class DocumentCatalog<TDocument, TValue, TUpdate = TValue> {
  constructor(
    private readonly options: DocumentCatalogOptions<
      TDocument,
      TValue,
      TUpdate
    >,
  ) {}

  get(): TValue {
    return this.options.select(this.options.store.get());
  }

  update(update: TUpdate): TValue {
    const nextDocument = this.options.store.update((document) =>
      this.options.applyUpdate(document, update),
    );

    return this.options.select(nextDocument);
  }
}

// ---------------------------------------------------------------------------
// Versioned envelopes (see REFACTOR.md §5.1)
//
// Every persisted JSON file embeds `{ schemaVersion: number, data: T }`.
// Load path:
//   read → decode envelope → if version < current: run migrations → decode T
// On fail: caller is expected to back up the corrupt primary and fall back to
// the default. The pure decode/migrate logic lives here; the fs-level
// side-effects live on the edge (node-aware callers).
// ---------------------------------------------------------------------------

export interface VersionedEnvelope<T> {
  schemaVersion: number;
  data: T;
}

export interface VersionedMigration {
  from: number;
  to: number;
  migrate: (oldData: unknown) => unknown;
}

export interface VersionedDecodeOptions<T> {
  currentVersion: number;
  migrations?: ReadonlyArray<VersionedMigration>;
  /**
   * Validator/decoder for the final `data` payload. Return the validated
   * value, or `null` to signal a decode failure. Implementations should be
   * pure type predicates/validators — no `as` casts.
   */
  decode: (raw: unknown) => T | null;
}

export type VersionedDecodeResult<T> =
  | { readonly ok: true; readonly data: T; readonly wasLegacy: boolean }
  | { readonly ok: false; readonly reason: VersionedDecodeFailureReason };

export type VersionedDecodeFailureReason =
  | "not-an-object"
  | "bad-envelope"
  | "missing-migration"
  | "migration-threw"
  | "decode-failed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasEnvelopeShape(
  raw: Record<string, unknown>,
): raw is { schemaVersion: number; data: unknown } {
  return (
    typeof raw.schemaVersion === "number" &&
    Number.isFinite(raw.schemaVersion) &&
    "data" in raw
  );
}

/**
 * Pure decode/migrate pipeline for a versioned envelope. Does no I/O.
 *
 *  - If `raw` is missing `schemaVersion` (or is not an envelope at all), it
 *    is treated as a legacy v1 payload and the whole `raw` value is passed
 *    to the decoder. This preserves backward compatibility with pre-envelope
 *    files.
 *  - Migrations are chained by matching `from` to the current version, then
 *    stepping forward until we reach `currentVersion`. If a required step is
 *    missing, the decode fails.
 */
export function decodeVersionedEnvelope<T>(
  raw: unknown,
  options: VersionedDecodeOptions<T>,
): VersionedDecodeResult<T> {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: "not-an-object" };
  }

  let legacy = true;
  let startVersion = 1;
  let initialData: unknown = raw;

  if (isRecord(raw) && hasEnvelopeShape(raw)) {
    legacy = false;
    startVersion = raw.schemaVersion;
    initialData = raw.data;
  }

  let version = startVersion;
  let data: unknown = initialData;
  const migrations = options.migrations ?? [];

  while (version < options.currentVersion) {
    const step = migrations.find((m) => m.from === version);
    if (!step) {
      return { ok: false, reason: "missing-migration" };
    }
    if (step.to <= version) {
      return { ok: false, reason: "bad-envelope" };
    }
    try {
      data = step.migrate(data);
    } catch {
      return { ok: false, reason: "migration-threw" };
    }
    version = step.to;
  }

  if (version !== options.currentVersion) {
    // Future-dated file or migration overshot. Safer to treat as corrupt.
    return { ok: false, reason: "bad-envelope" };
  }

  const decoded = options.decode(data);
  if (decoded === null) {
    return { ok: false, reason: "decode-failed" };
  }

  return { ok: true, data: decoded, wasLegacy: legacy };
}

export function wrapEnvelope<T>(
  data: T,
  schemaVersion: number,
): VersionedEnvelope<T> {
  return { schemaVersion, data };
}
