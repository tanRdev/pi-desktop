import os from "node:os";
import type { IpcRegistrar } from "../ipc-router";

/**
 * Sanitizes errors crossing the IPC main → renderer boundary.
 *
 * Why: Electron serializes `Error.message` and `Error.stack` over IPC. A
 * compromised renderer (XSS in third-party markdown, extension, etc.) can
 * exfiltrate those strings. Stacks and absolute paths leak filesystem
 * structure (e.g. `/Users/tan/...`), so we strip both before rethrowing.
 *
 * Beyond paths, we redact several classes of secrets so that accidental
 * inclusion of credentials in a thrown error's message (e.g. from a
 * misconfigured git remote URL) does not end up in the renderer's console.
 *
 * The original error is still logged in the main process via the injected
 * logger, so debugging remains possible from the terminal / log file.
 */

export interface SanitizeIpcErrorOptions {
  log: (error: unknown) => void;
}

const ABSOLUTE_POSIX_PATH = /(?<![A-Za-z0-9_])\/[^\s'"`]+/g;
const HOME_TILDE_PATH = /(?<![A-Za-z0-9_])~\/[^\s'"`]+/g;
// Windows drive letters followed by backslash path. Example: C:\Users\Admin\...
const WINDOWS_ABSOLUTE_PATH = /[A-Za-z]:\\[^\s'"`]+/g;

// Secrets: GitHub personal tokens, OpenAI/Anthropic-style keys, AWS keys,
// generic bearer tokens, email addresses. The patterns are intentionally
// aggressive — false-positive redactions in an error string are cheap; a
// leaked secret is not.
const GITHUB_TOKEN = /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{10,}/g;
const OPENAI_KEY = /\bsk-[A-Za-z0-9-_]{10,}/g;
const ANTHROPIC_KEY = /\bsk-ant-[A-Za-z0-9-_]{10,}/g;
const AWS_ACCESS_KEY = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;
const BEARER_TOKEN = /\b[Bb]earer\s+[A-Za-z0-9._-]+/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function scrubSecrets(message: string): string {
  return message
    .replace(ANTHROPIC_KEY, "<token>")
    .replace(OPENAI_KEY, "<token>")
    .replace(GITHUB_TOKEN, "<token>")
    .replace(AWS_ACCESS_KEY, "<token>")
    .replace(BEARER_TOKEN, "<token>")
    .replace(EMAIL, "<email>");
}

function scrubPaths(message: string): string {
  let out = message;

  // Explicit home-dir substitution so environments with exotic `$HOME` still
  // redact correctly.
  let home: string | undefined;
  try {
    home = os.homedir();
  } catch {
    home = undefined;
  }
  if (home && home.length > 0) {
    // Escape regex metacharacters in the home path.
    const escaped = home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "g"), "<home>");
  }

  return out
    .replace(WINDOWS_ABSOLUTE_PATH, "<path>")
    .replace(HOME_TILDE_PATH, "<path>")
    .replace(ABSOLUTE_POSIX_PATH, "<path>");
}

export function scrubErrorMessage(message: string): string {
  // Redact secrets before paths: secret patterns (e.g. `sk-...`) can contain
  // characters that a path-redactor would otherwise preserve.
  return scrubPaths(scrubSecrets(message));
}

export function sanitizeIpcError(
  error: unknown,
  options: SanitizeIpcErrorOptions,
): Error {
  options.log(error);

  if (!(error instanceof Error)) {
    return new Error("IPC operation failed");
  }

  const cleaned = new Error(scrubErrorMessage(error.message));
  cleaned.name = error.name;
  // Intentionally drop `stack`. Leaving it undefined prevents Electron from
  // serializing it across the boundary.
  cleaned.stack = undefined;
  // Preserve structured error codes (e.g. PathGuardError.code,
  // PayloadValidationError.code) so the renderer can discriminate without
  // depending on error message text.
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string") {
    Object.defineProperty(cleaned, "code", {
      value: code,
      enumerable: true,
    });
  }
  return cleaned;
}

/**
 * Wraps an `ipcMain.handle`-shaped registrar so every handler's thrown errors
 * are sanitized before they reach the renderer.
 */
export function createSanitizingHandle(
  inner: IpcRegistrar["handle"],
  options: SanitizeIpcErrorOptions,
): IpcRegistrar["handle"] {
  return (channel, listener) => {
    inner(channel, async (event, payload) => {
      try {
        return await listener(event, payload);
      } catch (error) {
        throw sanitizeIpcError(error, options);
      }
    });
  };
}
