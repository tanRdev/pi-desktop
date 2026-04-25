import fs from "node:fs";
import path from "node:path";

export function normalizePathId(value: string): string {
  const resolved = path.resolve(value);

  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved.replace(/[\\/]+$/, "") || resolved;
  }
}

export function resolveCommandCwd(targetPath: string): string {
  const resolved = path.resolve(targetPath);

  try {
    return fs.statSync(resolved).isFile() ? path.dirname(resolved) : resolved;
  } catch {
    return resolved;
  }
}

export function resolveInsideRepository(
  repositoryPath: string,
  relativeFilePath: string,
): string {
  if (typeof relativeFilePath !== "string" || relativeFilePath.length === 0) {
    throw new Error("File path must be a non-empty string");
  }
  if (path.isAbsolute(relativeFilePath)) {
    throw new Error("File path must be relative to the repository root");
  }

  const repoRoot = path.resolve(repositoryPath);
  const candidate = path.resolve(repoRoot, relativeFilePath);
  const relative = path.relative(repoRoot, candidate);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Refusing to operate on path outside repository: ${relativeFilePath}`,
    );
  }
  return candidate;
}
