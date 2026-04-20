import type { SearchRequest, TerminalCreateOptions } from "@pi-desktop/shared";
import type { OpenDialogOptions } from "electron";

/**
 * Strict payload parsers used by IPC handlers.
 *
 * Security properties enforced here:
 *  - Size caps on every string and array to prevent resource exhaustion via a
 *    malicious or compromised renderer.
 *  - Type checks reject non-matching primitives (no implicit coercion).
 *  - Strict parsers (`parseSearchRequestStrict`, `parseTerminalCreateOptionsStrict`,
 *    `parseDialogOptionsStrict`) reject unknown keys so the handler cannot be
 *    tricked into consuming hidden fields.
 *
 * All validation failures are raised as `PayloadValidationError`, which
 * carries a stable `code` suitable for returning to the renderer (after
 * sanitization via `sanitizeIpcError`).
 */

// 1 MB cap on any inbound string. Text-file writes are separately capped in
// the filesystem handler at 10 MB — this cap is for *every* string field on
// *every* IPC payload to stop generic DOS.
export const MAX_STRING_BYTES = 1_048_576;

// 10k element cap on any inbound array.
export const MAX_ARRAY_LENGTH = 10_000;

export type PayloadValidationCode =
  | "payload/not-object"
  | "payload/missing-field"
  | "payload/wrong-type"
  | "payload/string-too-large"
  | "payload/array-too-large"
  | "payload/unknown-keys"
  | "payload/empty-array"
  | "payload/null-byte";

export class PayloadValidationError extends Error {
  readonly code: PayloadValidationCode;
  readonly field?: string;

  constructor(code: PayloadValidationCode, message: string, field?: string) {
    super(message);
    this.name = "PayloadValidationError";
    this.code = code;
    this.field = field;
  }
}

function isPayloadRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertStringSize(
  value: string,
  key: string,
  maxBytes: number = MAX_STRING_BYTES,
): void {
  // Node's Buffer.byteLength counts UTF-8 bytes which is the relevant unit for
  // serialization cost. Cheap when string is ASCII.
  if (Buffer.byteLength(value, "utf-8") > maxBytes) {
    throw new PayloadValidationError(
      "payload/string-too-large",
      `field "${key}" exceeds maximum size of ${maxBytes} bytes`,
      key,
    );
  }
}

function assertArraySize(value: unknown[], key: string): void {
  if (value.length > MAX_ARRAY_LENGTH) {
    throw new PayloadValidationError(
      "payload/array-too-large",
      `field "${key}" exceeds maximum length of ${MAX_ARRAY_LENGTH} entries`,
      key,
    );
  }
}

export function getStringField(
  payload: unknown,
  key: string,
  options: { maxBytes?: number } = {},
): string | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }

  const value = payload[key];
  if (typeof value !== "string") {
    return undefined;
  }

  assertStringSize(value, key, options.maxBytes);
  return value;
}

export function getNumberField(
  payload: unknown,
  key: string,
): number | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }

  const value = payload[key];
  // Reject NaN and infinities — they are never valid for any numeric field we
  // accept over IPC (sizes, positions, counts).
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function getBooleanField(
  payload: unknown,
  key: string,
): boolean | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }

  const value = payload[key];
  return typeof value === "boolean" ? value : undefined;
}

export function getStringArrayField(
  payload: unknown,
  key: string,
): string[] | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }

  const value = payload[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  assertArraySize(value, key);
  const filtered = value.filter(
    (entry): entry is string => typeof entry === "string",
  );
  for (const entry of filtered) {
    assertStringSize(entry, key);
  }
  return filtered;
}

/** Require a string field, throwing `PayloadValidationError` if absent. */
export function requireStringField(payload: unknown, key: string): string {
  if (!isPayloadRecord(payload)) {
    throw new PayloadValidationError(
      "payload/not-object",
      "payload must be an object",
      key,
    );
  }
  const value = payload[key];
  if (typeof value !== "string") {
    throw new PayloadValidationError(
      value === undefined ? "payload/missing-field" : "payload/wrong-type",
      `field "${key}" must be a string`,
      key,
    );
  }
  assertStringSize(value, key);
  return value;
}

const DIALOG_ALLOWED_PROPERTIES: ReadonlySet<string> = new Set([
  "openFile",
  "openDirectory",
  "multiSelections",
  "showHiddenFiles",
  "createDirectory",
  "promptToCreate",
  "noResolveAliases",
  "treatPackageAsDirectory",
  "dontAddToRecent",
]);

type DialogProperty = NonNullable<OpenDialogOptions["properties"]>[number];

function isDialogProperty(value: string): value is DialogProperty {
  return DIALOG_ALLOWED_PROPERTIES.has(value);
}

const DIALOG_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "title",
  "properties",
]);

function assertNoUnknownKeys(
  payload: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): void {
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      throw new PayloadValidationError(
        "payload/unknown-keys",
        `unknown field "${key}"`,
        key,
      );
    }
  }
}

export function parseDialogOptions(payload: unknown): OpenDialogOptions {
  const options: OpenDialogOptions = {};
  const title = getStringField(payload, "title");
  if (title) {
    options.title = title;
  }

  const properties = getStringArrayField(payload, "properties");
  if (properties) {
    options.properties = properties.filter(isDialogProperty);
  }

  return options;
}

export function parseDialogOptionsStrict(payload: unknown): OpenDialogOptions {
  if (payload === undefined || payload === null) {
    return {};
  }
  if (!isPayloadRecord(payload)) {
    throw new PayloadValidationError(
      "payload/not-object",
      "dialog options must be an object",
    );
  }
  assertNoUnknownKeys(payload, DIALOG_ALLOWED_KEYS);
  return parseDialogOptions(payload);
}

const SEARCH_REQUEST_KEYS: ReadonlySet<string> = new Set([
  "query",
  "rootPath",
  "maxResults",
  "includePatterns",
  "excludePatterns",
]);

export function parseSearchRequest(payload: unknown): SearchRequest | null {
  const query = getStringField(payload, "query");
  const rootPath = getStringField(payload, "rootPath");
  if (!query || !rootPath) {
    return null;
  }

  return {
    query,
    rootPath,
    maxResults: getNumberField(payload, "maxResults"),
    includePatterns: getStringArrayField(payload, "includePatterns"),
    excludePatterns: getStringArrayField(payload, "excludePatterns"),
  };
}

export function parseSearchRequestStrict(payload: unknown): SearchRequest {
  if (!isPayloadRecord(payload)) {
    throw new PayloadValidationError(
      "payload/not-object",
      "search request must be an object",
    );
  }
  assertNoUnknownKeys(payload, SEARCH_REQUEST_KEYS);
  const query = requireStringField(payload, "query");
  const rootPath = requireStringField(payload, "rootPath");
  return {
    query,
    rootPath,
    maxResults: getNumberField(payload, "maxResults"),
    includePatterns: getStringArrayField(payload, "includePatterns"),
    excludePatterns: getStringArrayField(payload, "excludePatterns"),
  };
}

const TERMINAL_CREATE_KEYS: ReadonlySet<string> = new Set([
  "id",
  "cols",
  "rows",
  "ownerWindowId",
  "cwd",
  "backend",
]);

export function parseTerminalCreateOptions(
  payload: unknown,
): TerminalCreateOptions | null {
  const id = getStringField(payload, "id");
  const cols = getNumberField(payload, "cols");
  const rows = getNumberField(payload, "rows");
  const ownerWindowId = getStringField(payload, "ownerWindowId");
  if (
    !id ||
    typeof cols !== "number" ||
    typeof rows !== "number" ||
    !ownerWindowId
  ) {
    return null;
  }

  const backend = getStringField(payload, "backend");

  return {
    id,
    cols,
    rows,
    ownerWindowId,
    cwd: getStringField(payload, "cwd"),
    backend: backend === "shell" || backend === "pi" ? backend : undefined,
  };
}

export function parseTerminalCreateOptionsStrict(
  payload: unknown,
): TerminalCreateOptions {
  if (!isPayloadRecord(payload)) {
    throw new PayloadValidationError(
      "payload/not-object",
      "terminal create options must be an object",
    );
  }
  assertNoUnknownKeys(payload, TERMINAL_CREATE_KEYS);
  const id = requireStringField(payload, "id");
  const ownerWindowId = requireStringField(payload, "ownerWindowId");
  const cols = getNumberField(payload, "cols");
  const rows = getNumberField(payload, "rows");
  if (typeof cols !== "number") {
    throw new PayloadValidationError(
      "payload/missing-field",
      'field "cols" must be a finite number',
      "cols",
    );
  }
  if (typeof rows !== "number") {
    throw new PayloadValidationError(
      "payload/missing-field",
      'field "rows" must be a finite number',
      "rows",
    );
  }
  const backend = getStringField(payload, "backend");
  return {
    id,
    cols,
    rows,
    ownerWindowId,
    cwd: getStringField(payload, "cwd"),
    backend: backend === "shell" || backend === "pi" ? backend : undefined,
  };
}
