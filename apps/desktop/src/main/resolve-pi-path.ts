import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Well-known directories where `pi` may be installed but that Electron
 * (launched from Dock / Finder) will NOT have on its inherited PATH.
 */
const EXTRA_SEARCH_DIRS: readonly string[] = [
  // mise / asdf / nvm managed node installs
  path.join(process.env.HOME ?? "/", ".local", "share", "mise", "shims"),
  // Homebrew (Apple Silicon)
  "/opt/homebrew/bin",
  // Homebrew (Intel)
  "/usr/local/bin",
  // npm global
  path.join(process.env.HOME ?? "/", ".npm-global", "bin"),
  // pnpm global
  path.join(process.env.HOME ?? "/", ".local", "share", "pnpm"),
  // yarn global
  path.join(process.env.HOME ?? "/", ".yarn", "bin"),
  // Volta
  path.join(process.env.HOME ?? "/", ".volta", "bin"),
  // fnm
  path.join(
    process.env.HOME ?? "/",
    ".local",
    "share",
    "fnm",
    "aliases",
    "default",
    "bin",
  ),
  // cargo (in case it's a Rust-based pi)
  path.join(process.env.HOME ?? "/", ".cargo", "bin"),
  // Default PATH entries
  "/usr/bin",
  "/bin",
];

let cachedPath: string | null = null;

/**
 * Resolve the absolute path to the `pi` CLI binary.
 *
 * Strategy (in order):
 * 1. `PI_CLI_PATH` env var — explicit override
 * 2. Cached result from a previous call
 * 3. `which pi` via the user's login shell (picks up shell profile)
 * 4. Direct filesystem scan of well-known directories
 *
 * Returns the absolute path if found, or `null` if `pi` cannot be located.
 */
export function resolvePiPath(): string | null {
  // 1. Explicit env override
  const envPath = process.env.PI_CLI_PATH;
  if (envPath && existsSync(envPath)) {
    cachedPath = envPath;
    return cachedPath;
  }

  // 2. Cached result
  if (cachedPath !== null) {
    return cachedPath;
  }

  // 3. Shell-based lookup — ask the user's login shell for the full PATH
  const resolved = resolveViaShell();
  if (resolved) {
    cachedPath = resolved;
    return cachedPath;
  }

  // 4. Direct filesystem scan
  const scanned = resolveViaFilesystem();
  if (scanned) {
    cachedPath = scanned;
    return cachedPath;
  }

  return null;
}

/**
 * Returns the resolved path or throws with a user-friendly message.
 */
export function resolvePiPathOrThrow(): string {
  const resolved = resolvePiPath();
  if (!resolved) {
    throw new PiNotFoundError();
  }
  return resolved;
}

/**
 * Builds a PATH string that includes the directory containing `pi`
 * plus all well-known directories, merged with the current process PATH.
 * Use this when spawning processes that themselves may need to find `pi`.
 */
export function buildEnhancedPath(): string {
  const currentPath = process.env.PATH ?? "";
  const currentDirs = new Set(currentPath.split(path.delimiter));
  const extraDirs = EXTRA_SEARCH_DIRS.filter((d) => !currentDirs.has(d));

  const piResolved = resolvePiPath();
  if (piResolved) {
    const piDir = path.dirname(piResolved);
    if (!currentDirs.has(piDir)) {
      extraDirs.unshift(piDir);
    }
  }

  if (extraDirs.length === 0) {
    return currentPath;
  }

  return [...extraDirs, currentPath].join(path.delimiter);
}

export class PiNotFoundError extends Error {
  readonly code = "PI_NOT_FOUND";

  constructor() {
    super(
      [
        "Could not find the 'pi' CLI.",
        "",
        "Make sure 'pi' is installed and on your PATH.",
        "You can also set the PI_CLI_PATH environment variable to the absolute path of the binary.",
        "",
        "Checked: login shell PATH, " +
          EXTRA_SEARCH_DIRS.filter((d) => existsSync(d))
            .map((d) => d.replace(process.env.HOME ?? "", "~"))
            .join(", "),
      ].join("\n"),
    );
    this.name = "PiNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveViaShell(): string | null {
  try {
    const shell = process.env.SHELL ?? "/bin/zsh";
    // -ilc: interactive login shell so .zshrc / .bash_profile are sourced
    const result = execSync(`${shell} -ilc "which pi"`, {
      timeout: 5_000,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env },
    }).trim();

    if (result && existsSync(result)) {
      return result;
    }
  } catch {
    // which failed or shell timed out — fall through
  }
  return null;
}

function resolveViaFilesystem(): string | null {
  const binaryName = process.platform === "win32" ? "pi.exe" : "pi";
  for (const dir of EXTRA_SEARCH_DIRS) {
    const candidate = path.join(dir, binaryName);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
