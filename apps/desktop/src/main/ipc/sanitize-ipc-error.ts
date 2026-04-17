import type { IpcRegistrar } from "../ipc-router";

/**
 * Sanitizes errors crossing the IPC main → renderer boundary.
 *
 * Why: Electron serializes `Error.message` and `Error.stack` over IPC. A
 * compromised renderer (XSS in third-party markdown, extension, etc.) can
 * exfiltrate those strings. Stacks and absolute paths leak filesystem
 * structure (e.g. `/Users/tan/...`), so we strip both before rethrowing.
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

function scrubPaths(message: string): string {
  return message
    .replace(WINDOWS_ABSOLUTE_PATH, "<path>")
    .replace(HOME_TILDE_PATH, "<path>")
    .replace(ABSOLUTE_POSIX_PATH, "<path>");
}

export function sanitizeIpcError(
  error: unknown,
  options: SanitizeIpcErrorOptions,
): Error {
  options.log(error);

  if (!(error instanceof Error)) {
    return new Error("IPC operation failed");
  }

  const cleaned = new Error(scrubPaths(error.message));
  cleaned.name = error.name;
  // Intentionally drop `stack`. Leaving it undefined prevents Electron from
  // serializing it across the boundary.
  cleaned.stack = undefined;
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
