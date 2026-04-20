import { realpathSync as realpathSyncDefault } from "node:fs";
import path from "node:path";
import { Data } from "effect";

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

/**
 * Stable error codes for path guard failures. Used by IPC handlers so the
 * renderer can show accurate, localized messages without seeing raw paths.
 */
export type PathGuardCode =
  | "path/no-root-configured"
  | "path/not-a-string"
  | "path/contains-null-byte"
  | "path/outside-root"
  | "path/symlink-escape";

/**
 * Effect-style tagged error consistent with apps/desktop/src/main/effect/errors.ts.
 * Callers that use plain try/catch can still pattern-match on `_tag` and
 * `code`.
 */
export class PathGuardError extends Data.TaggedError("PathGuardError")<{
  readonly code: PathGuardCode;
  readonly message: string;
  readonly attemptedPath?: string;
}> {
  override toString(): string {
    return `PathGuardError[${this.code}]: ${this.message}`;
  }
}

export interface ResolveInsideRootOptions {
  /**
   * When `true` (the default) the returned path is passed through
   * `fs.realpathSync` so symlinks are resolved to their real target. If the
   * target does not yet exist (e.g. for a write), the nearest existing
   * ancestor is canonicalized instead and the containment check is repeated
   * against the ancestor.
   */
  allowCreate?: boolean;
}

/**
 * Resolve `userPath` against a set of allowed roots, enforcing all path
 * security rules in one place:
 *   - `userPath` must be a non-empty string.
 *   - `userPath` must not contain NUL bytes (POSIX path-truncation attack).
 *   - Relative paths are resolved against the first root.
 *   - After `path.resolve()`, the target must lie within one of the roots
 *     both lexically AND after following any symlinks (`fs.realpath`).
 *
 * Throws `PathGuardError` with a stable `code` on any violation.
 */
export function resolveInsideRoot(
  allowedRoots: readonly string[],
  userPath: unknown,
  options: ResolveInsideRootOptions = {},
): string {
  if (allowedRoots.length === 0) {
    throw new PathGuardError({
      code: "path/no-root-configured",
      message: "no allowed roots configured",
    });
  }

  if (typeof userPath !== "string" || userPath.length === 0) {
    throw new PathGuardError({
      code: "path/not-a-string",
      message: "path must be a non-empty string",
    });
  }

  if (userPath.includes("\0")) {
    throw new PathGuardError({
      code: "path/contains-null-byte",
      message: "path must not contain a NUL byte",
    });
  }

  const allowCreate = options.allowCreate ?? false;
  const primaryRoot = path.resolve(allowedRoots[0] ?? "");
  const resolvedTarget = path.isAbsolute(userPath)
    ? path.resolve(userPath)
    : path.resolve(primaryRoot, userPath);

  // First: lexical containment must hold against at least one allowed root.
  // This rejects `..` traversal before we touch the filesystem.
  const resolvedRoots = allowedRoots.map((r) => path.resolve(r));
  const lexicalMatch = resolvedRoots.some((root) =>
    isPathWithin(root, resolvedTarget),
  );
  if (!lexicalMatch) {
    throw new PathGuardError({
      code: "path/outside-root",
      message: "path resolves outside every allowed root",
      attemptedPath: resolvedTarget,
    });
  }

  // Second: if the path exists, canonicalize and re-check so a symlink cannot
  // escape the root.
  const canonical = tryRealpath(resolvedTarget);
  if (canonical !== null) {
    const canonicalMatch = resolvedRoots.some((root) =>
      isPathWithin(root, canonical),
    );
    if (!canonicalMatch) {
      throw new PathGuardError({
        code: "path/symlink-escape",
        message: "path resolves (via symlink) outside every allowed root",
        attemptedPath: resolvedTarget,
      });
    }
    return canonical;
  }

  // Third: path does not exist. Only allow when `allowCreate` is set AND the
  // nearest existing ancestor is still within an allowed root (blocks
  // symlinked parents that would push new files out of tree).
  if (!allowCreate) {
    throw new PathGuardError({
      code: "path/outside-root",
      message: "path does not exist",
      attemptedPath: resolvedTarget,
    });
  }

  let parent = path.dirname(resolvedTarget);
  while (true) {
    const canonicalAncestor = tryRealpath(parent);
    if (canonicalAncestor !== null) {
      const ancestorMatch = resolvedRoots.some((root) =>
        isPathWithin(root, canonicalAncestor),
      );
      if (!ancestorMatch) {
        throw new PathGuardError({
          code: "path/symlink-escape",
          message: "nearest existing ancestor is outside every allowed root",
          attemptedPath: resolvedTarget,
        });
      }
      return resolvedTarget;
    }
    const next = path.dirname(parent);
    if (next === parent) {
      // Walked off the root without finding anything. Conservatively reject.
      throw new PathGuardError({
        code: "path/outside-root",
        message: "no existing ancestor of path could be canonicalized",
        attemptedPath: resolvedTarget,
      });
    }
    parent = next;
  }
}
