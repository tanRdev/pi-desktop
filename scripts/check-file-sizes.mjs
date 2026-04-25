import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCAN_ROOTS = [
  "apps/desktop/src/main",
  "apps/desktop/src/preload",
  "apps/desktop/src/renderer/src",
  "packages/agent-host/src",
  "packages/contracts/src",
  "packages/shared/src",
  "packages/shell-model/src",
  "packages/ui/src",
];

const RENDERER_ROOT = "apps/desktop/src/renderer/src";

const SOURCE_FILE_PATTERN = /\.(?:[cm]?ts|tsx)$/;
const IGNORED_FILE_PATTERN = /(?:\.d\.ts|\.(?:spec|test)\.(?:[cm]?ts|tsx))$/;
const IGNORED_DIR_NAMES = new Set(["node_modules", "dist", "out", "build"]);

const DEFAULT_CAP = 300;
const COMPONENT_CAP = 200;
const BASELINE_RELATIVE_PATH = "scripts/file-size-baseline.json";

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function shouldScanFile(relativePath) {
  return (
    SOURCE_FILE_PATTERN.test(relativePath) &&
    !IGNORED_FILE_PATTERN.test(relativePath)
  );
}

function walkSourceFiles(rootDir, currentRelativeDir) {
  const absoluteDir = path.join(rootDir, currentRelativeDir);
  if (!existsSync(absoluteDir)) {
    return [];
  }

  const filePaths = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIR_NAMES.has(entry.name)) {
        continue;
      }
      const nextRelative = toPosixPath(
        path.join(currentRelativeDir, entry.name),
      );
      filePaths.push(...walkSourceFiles(rootDir, nextRelative));
      continue;
    }

    const relativePath = toPosixPath(path.join(currentRelativeDir, entry.name));
    if (shouldScanFile(relativePath)) {
      filePaths.push(relativePath);
    }
  }

  return filePaths;
}

/**
 * Count code lines of code: non-blank and not a pure comment line.
 * Tracks block-comment state across lines.
 */
export function countCodeLoc(sourceText) {
  const lines = sourceText.split(/\r?\n/);
  let inBlockComment = false;
  let count = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    // Walk the line character-by-character to determine whether any "code"
    // survives after stripping comments.
    let hasCode = false;
    let index = 0;
    while (index < line.length) {
      if (inBlockComment) {
        const end = line.indexOf("*/", index);
        if (end === -1) {
          index = line.length;
          break;
        }
        index = end + 2;
        inBlockComment = false;
        continue;
      }

      const twoChar = line.slice(index, index + 2);
      if (twoChar === "//") {
        // rest of line is a line comment
        break;
      }
      if (twoChar === "/*") {
        inBlockComment = true;
        index += 2;
        continue;
      }

      if (!/\s/u.test(line[index])) {
        hasCode = true;
      }
      index += 1;
    }

    if (hasCode) {
      count += 1;
    }
  }

  return count;
}

function capForFile(relativePath) {
  if (
    relativePath.startsWith(`${RENDERER_ROOT}/`) &&
    relativePath.endsWith(".tsx")
  ) {
    return COMPONENT_CAP;
  }
  return DEFAULT_CAP;
}

export function collectFileSizes(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const results = [];

  for (const scanRoot of SCAN_ROOTS) {
    const files = walkSourceFiles(rootDir, scanRoot);
    for (const relativePath of files) {
      const absolutePath = path.join(rootDir, relativePath);
      const sourceText = readFileSync(absolutePath, "utf8");
      const loc = countCodeLoc(sourceText);
      results.push({
        filePath: relativePath,
        loc,
        cap: capForFile(relativePath),
      });
    }
  }

  results.sort((left, right) => left.filePath.localeCompare(right.filePath));
  return results;
}

function readBaseline(rootDir) {
  const baselinePath = path.join(rootDir, BASELINE_RELATIVE_PATH);
  if (!existsSync(baselinePath)) {
    return {};
  }
  const raw = readFileSync(baselinePath, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `Invalid baseline file at ${BASELINE_RELATIVE_PATH}: expected JSON object`,
    );
  }
  return parsed;
}

function writeBaseline(rootDir, entries) {
  const baselinePath = path.join(rootDir, BASELINE_RELATIVE_PATH);
  const payload = {};
  for (const entry of entries) {
    if (entry.loc > entry.cap) {
      payload[entry.filePath] = entry.loc;
    }
  }

  const sortedKeys = Object.keys(payload).sort((a, b) => a.localeCompare(b));
  const sortedPayload = {};
  for (const key of sortedKeys) {
    sortedPayload[key] = payload[key];
  }

  const json = `${JSON.stringify(sortedPayload, null, 2)}\n`;
  writeFileSync(baselinePath, json);
  return { path: baselinePath, count: sortedKeys.length };
}

export function checkFileSizes(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const baseline = readBaseline(rootDir);
  const entries = collectFileSizes({ rootDir });

  const violations = [];
  const tighten = [];
  const seenBaselineKeys = new Set();

  for (const entry of entries) {
    const baselineLoc = baseline[entry.filePath];
    if (typeof baselineLoc === "number") {
      seenBaselineKeys.add(entry.filePath);
      if (entry.loc > baselineLoc) {
        violations.push({
          filePath: entry.filePath,
          loc: entry.loc,
          cap: entry.cap,
          baseline: baselineLoc,
          kind: "exceeds-baseline",
        });
        continue;
      }
      if (entry.loc < baselineLoc) {
        tighten.push({
          filePath: entry.filePath,
          loc: entry.loc,
          baseline: baselineLoc,
        });
      }
      continue;
    }

    if (entry.loc > entry.cap) {
      violations.push({
        filePath: entry.filePath,
        loc: entry.loc,
        cap: entry.cap,
        baseline: null,
        kind: "exceeds-cap",
      });
    }
  }

  const staleBaselineKeys = Object.keys(baseline).filter(
    (key) => !seenBaselineKeys.has(key),
  );

  return { entries, violations, tighten, staleBaselineKeys };
}

function formatViolation(violation) {
  if (violation.kind === "exceeds-baseline") {
    return `${violation.filePath}: ${violation.loc} LOC > baseline ${violation.baseline} (cap ${violation.cap})`;
  }
  return `${violation.filePath}: ${violation.loc} LOC > cap ${violation.cap}`;
}

function runCli(argv) {
  const rootDir = process.cwd();
  const writeBaselineFlag = argv.includes("--write-baseline");

  if (writeBaselineFlag) {
    const entries = collectFileSizes({ rootDir });
    const result = writeBaseline(rootDir, entries);
    console.log(
      `Wrote baseline to ${BASELINE_RELATIVE_PATH} with ${result.count} entries.`,
    );
    return;
  }

  const { violations, tighten, staleBaselineKeys } = checkFileSizes({
    rootDir,
  });

  for (const note of tighten) {
    console.log(
      `info: ${note.filePath} dropped to ${note.loc} LOC (baseline ${note.baseline}). You can tighten the baseline.`,
    );
  }

  for (const key of staleBaselineKeys) {
    console.log(
      `info: baseline entry ${key} no longer exists. You can remove it from the baseline.`,
    );
  }

  if (violations.length === 0) {
    console.log("File size check passed.");
    return;
  }

  console.error("File size violations found:");
  for (const violation of violations) {
    console.error(`- ${formatViolation(violation)}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2));
}
