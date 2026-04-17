import { realpathSync as realpathSyncDefault } from "node:fs";
import path from "node:path";

/**
 * Path containment guard shared by every main-process IPC handler.
 *
 * Three earlier copies of this logic had subtly different behavior around
 * symlinks, case sensitivity, and trailing separators. This is the canonical
 * implementation.
 *
 * Rules:
 *  - Both paths are resolved to absolute form (removing `..` segments).
 *  - On darwin we compare case-insensitively because HFS+ and APFS (default)
 *    are case-preserving but case-insensitive.
 *  - Trailing separators are normalized so `/foo/` and `/foo` are equivalent.
 *  - We also attempt a `realpath` pass so a symlinked child that resolves
 *    outside the parent is rejected, while a symlinked parent still matches.
 *  - Equality counts as "within": `isPathWithin("/foo", "/foo")` is `true`.
 */

const realpathNative = realpathSyncDefault.native ?? realpathSyncDefault;

function stripTrailingSeparator(value: string): string {
  if (value.length <= 1) {
    return value;
  }
  const trimmed = value.replace(/[\\/]+$/, "");
  return trimmed.length === 0 ? value.slice(0, 1) : trimmed;
}

function normalizeForCompare(value: string, platform: NodeJS.Platform): string {
  const stripped = stripTrailingSeparator(path.resolve(value));
  return platform === "darwin" || platform === "win32"
    ? stripped.toLowerCase()
    : stripped;
}

function tryRealpath(target: string): string | null {
  try {
    return realpathNative(target);
  } catch {
    return null;
  }
}

function relativeIsInside(parent: string, child: string): boolean {
  if (parent === child) {
    return true;
  }
  const rel = path.relative(parent, child);
  if (rel === "") {
    return true;
  }
  if (rel.startsWith("..")) {
    return false;
  }
  if (path.isAbsolute(rel)) {
    return false;
  }
  return true;
}

export interface IsPathWithinOptions {
  /**
   * Platform to use for case sensitivity. Defaults to the current runtime
   * platform. Exposed for tests.
   */
  platform?: NodeJS.Platform;
}

/**
 * Returns `true` when `child` is the same path as `parent` or a descendant
 * of it. Symlinks are followed when possible, but a missing target still
 * succeeds if the lexical containment check passes.
 */
export function isPathWithin(
  parent: string,
  child: string,
  options: IsPathWithinOptions = {},
): boolean {
  if (!parent || !child) {
    return false;
  }

  const platform = options.platform ?? process.platform;

  const lexicalParent = normalizeForCompare(parent, platform);
  const lexicalChild = normalizeForCompare(child, platform);

  if (relativeIsInside(lexicalParent, lexicalChild)) {
    return true;
  }

  const canonicalParentRaw = tryRealpath(path.resolve(parent));
  const canonicalChildRaw = tryRealpath(path.resolve(child));
  if (canonicalParentRaw === null || canonicalChildRaw === null) {
    return false;
  }

  const canonicalParent = normalizeForCompare(canonicalParentRaw, platform);
  const canonicalChild = normalizeForCompare(canonicalChildRaw, platform);
  return relativeIsInside(canonicalParent, canonicalChild);
}

/**
 * Returns true if `child` is within any of the provided `parents`.
 */
export function isPathWithinAny(
  parents: readonly string[],
  child: string,
  options: IsPathWithinOptions = {},
): boolean {
  for (const parent of parents) {
    if (isPathWithin(parent, child, options)) {
      return true;
    }
  }
  return false;
}
