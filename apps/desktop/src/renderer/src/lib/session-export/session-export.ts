const EXPORT_VERSION = 1;
const APP_VERSION = "0.1.0";

const SENSITIVE_KEYS = new Set([
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "api_key",
  "secret",
  "password",
  "credentials",
  "authorization",
  "auth",
  "sessionToken",
  "privateKey",
  "private_key",
]);

interface ExportEnvelope {
  version: number;
  exportDate: string;
  appVersion: string;
  session: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepCloneWithRedaction(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepCloneWithRedaction(item));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_KEYS.has(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = deepCloneWithRedaction(obj[key]);
      }
    }
    return result;
  }
  return value;
}

export function cloneForExport(session: unknown): unknown {
  return deepCloneWithRedaction(session);
}

export function exportSession(session: unknown): string {
  const envelope: ExportEnvelope = {
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    appVersion: APP_VERSION,
    session: cloneForExport(session),
  };
  return JSON.stringify(envelope, null, 2);
}

export function importSession(json: string): {
  session: unknown;
  warnings: string[];
} {
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON: unable to parse input");
  }

  if (!isRecord(parsed)) {
    throw new Error("Invalid structure: expected a JSON object at the root");
  }

  if (!("version" in parsed) || typeof parsed.version !== "number") {
    throw new Error("Invalid structure: missing or invalid 'version' field");
  }

  if (!("session" in parsed)) {
    throw new Error("Invalid structure: missing 'session' field");
  }

  if (parsed.version !== EXPORT_VERSION) {
    warnings.push(
      `Version mismatch: export version is ${parsed.version}, current version is ${EXPORT_VERSION}`,
    );
  }

  if (!isRecord(parsed.session)) {
    throw new Error("Invalid structure: 'session' must be a JSON object");
  }

  const knownTopLevelKeys = new Set([
    "version",
    "exportDate",
    "appVersion",
    "session",
  ]);
  for (const key of Object.keys(parsed)) {
    if (!knownTopLevelKeys.has(key)) {
      warnings.push(`Unknown field in envelope: '${key}'`);
    }
  }

  return { session: parsed.session, warnings };
}
