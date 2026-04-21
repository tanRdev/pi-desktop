/**
 * Redaction for log payloads and error messages.
 *
 * Mirrors the path-scrubbing patterns used by
 * `apps/desktop/src/main/ipc/sanitize-ipc-error.ts` and extends them with
 * tokens / emails / secrets. Pure — safe to run in any process.
 */

// Absolute POSIX path: `/Users/...`. Negative lookbehind avoids matching
// division or protocol-relative URLs like `http://`.
const ABSOLUTE_POSIX_PATH = /(?<![A-Za-z0-9_:/])\/[^\s'"`]+/g;
// `~/...`
const HOME_TILDE_PATH = /(?<![A-Za-z0-9_])~\/[^\s'"`]+/g;
// Windows drive letters: `C:\Users\...`
const WINDOWS_ABSOLUTE_PATH = /[A-Za-z]:\\[^\s'"`]+/g;
// Email addresses
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// GitHub / generic token prefixes (ghp_, gho_, ghs_, github_pat_, sk-, Bearer ...)
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const GITHUB_TOKEN = /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g;
const GITHUB_PAT = /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g;
const OPENAI_LIKE = /\bsk-[A-Za-z0-9-_]{20,}\b/g;
// Generic long hex / base64 token >= 32 chars (conservative)
const LONG_HEX = /\b[A-Fa-f0-9]{32,}\b/g;

// Field names whose values should always be fully replaced, regardless of
// content shape. Case-insensitive match.
const SECRET_KEYS: readonly string[] = [
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "auth",
  "cookie",
  "session",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "privatekey",
  "private_key",
];

const SECRET_KEY_SET = new Set(SECRET_KEYS.map((k) => k.toLowerCase()));

function isSecretKey(key: string): boolean {
  return SECRET_KEY_SET.has(key.toLowerCase());
}

/**
 * Redacts sensitive substrings inside a string. Order matters: paths first
 * so that path segments don't get partially matched as tokens.
 */
export function redactString(input: string): string {
  let out = input;
  out = out.replace(WINDOWS_ABSOLUTE_PATH, "<path>");
  out = out.replace(HOME_TILDE_PATH, "<path>");
  out = out.replace(ABSOLUTE_POSIX_PATH, "<path>");
  out = out.replace(EMAIL, "<email>");
  out = out.replace(BEARER, "Bearer <redacted>");
  out = out.replace(GITHUB_PAT, "<redacted-token>");
  out = out.replace(GITHUB_TOKEN, "<redacted-token>");
  out = out.replace(OPENAI_LIKE, "<redacted-token>");
  out = out.replace(LONG_HEX, "<redacted>");
  return out;
}

/**
 * Recursively redacts a value. Objects / arrays are walked; primitives
 * other than strings are returned as-is. Cycles are broken by returning
 * `"<cycle>"` when revisiting the same object.
 */
export function redact(input: unknown): unknown {
  return redactValue(input, new WeakSet<object>());
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null) return null;
  if (value === undefined) return undefined;

  const t = typeof value;
  if (t === "string") {
    if (typeof value === "string") return redactString(value);
    return value;
  }
  if (t === "number" || t === "boolean" || t === "bigint") return value;
  if (t === "function" || t === "symbol") return "<redacted>";

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    };
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return "<cycle>";
    seen.add(value);
    return value.map((item) => redactValue(item, seen));
  }

  if (t === "object" && value !== null) {
    const obj = value;
    if (seen.has(obj)) return "<cycle>";
    seen.add(obj);
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(obj)) {
      if (isSecretKey(key)) {
        out[key] = "<redacted>";
        continue;
      }
      out[key] = redactValue(child, seen);
    }
    return out;
  }

  return value;
}
