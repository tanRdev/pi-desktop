import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const kibibyte = 1024;
const mebibyte = kibibyte * 1024;

export function formatBytes(bytes) {
  if (bytes < kibibyte) {
    return `${bytes} B`;
  }

  if (bytes < mebibyte) {
    return `${(bytes / kibibyte).toFixed(1)} KiB`;
  }

  return `${(bytes / mebibyte).toFixed(2)} MiB`;
}

export function readBudgetBytes(name, fallbackValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new Error(`Invalid byte budget for ${name}: ${rawValue}`);
  }

  return parsedValue;
}

export function resolveRootDir(rootArg = process.argv[2]) {
  return path.resolve(rootArg ?? process.cwd());
}

export function measureFileSize(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }

  const stats = statSync(absolutePath);
  if (!stats.isFile()) {
    throw new Error(`Expected file: ${relativePath}`);
  }

  return stats.size;
}

export function measureDirectorySize(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required directory: ${relativePath}`);
  }

  return walkDirectorySize(absolutePath, relativePath);
}

function walkDirectorySize(absolutePath, relativePath) {
  const stats = statSync(absolutePath);
  if (stats.isFile()) {
    return stats.size;
  }

  if (!stats.isDirectory()) {
    throw new Error(`Expected directory: ${relativePath}`);
  }

  let totalSize = 0;

  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    totalSize += walkDirectorySize(
      path.join(absolutePath, entry.name),
      path.posix.join(relativePath, entry.name),
    );
  }

  return totalSize;
}

export function reportBudgetResults(checkName, results) {
  const failedResults = results.filter(
    (result) => result.error !== null || result.actualBytes > result.maxBytes,
  );
  const writeLine = failedResults.length === 0 ? console.log : console.error;

  writeLine(
    `${checkName} budget check ${failedResults.length === 0 ? "passed" : "failed"}`,
  );

  for (const result of results) {
    if (result.error !== null) {
      writeLine(result.error);
      continue;
    }

    writeLine(
      `${result.label}: ${formatBytes(result.actualBytes)} / ${formatBytes(result.maxBytes)}`,
    );
  }

  return failedResults.length === 0 ? 0 : 1;
}

export function runBudgetChecks(checkName, checks, rootDir = resolveRootDir()) {
  const results = checks.map((check) => {
    try {
      const actualBytes = check.measure(rootDir);
      return {
        label: check.label,
        actualBytes,
        maxBytes: check.maxBytes,
        error: null,
      };
    } catch (error) {
      return {
        label: check.label,
        actualBytes: 0,
        maxBytes: check.maxBytes,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  return reportBudgetResults(checkName, results);
}
