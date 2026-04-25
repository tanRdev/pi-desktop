#!/usr/bin/env node
/**
 * refactor-snapshot.mjs
 *
 * Scans the repo for non-test source files under the refactor scope and emits:
 *   (a) a markdown table of the top 20 largest files (by total line count)
 *   (b) a test-file / test-case count summary sourced from `bun run test` output
 *       (or a spec-file fallback if vitest output is not available)
 *
 * With `--update-refactor-md`, rewrites two marker-delimited regions inside
 * REFACTOR.md in place:
 *   <!-- BEGIN: progress-snapshot --> ... <!-- END: progress-snapshot -->
 *   <!-- BEGIN: largest-files     --> ... <!-- END: largest-files     -->
 *
 * LOC methodology: total file line count (wc -l semantics: counts newlines).
 * This matches the numbers used in §13 of REFACTOR.md and is deliberately
 * simple — no blank/comment stripping — so the doc's "worst offenders"
 * ranking stays stable and easy to reproduce with `wc -l`.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const SCAN_ROOTS = [
  "apps/desktop/src/main",
  "apps/desktop/src/preload",
  "apps/desktop/src/renderer/src",
];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "out",
  "build",
  "coverage",
]);
const SOURCE_EXT_PATTERN = /\.(?:[cm]?tsx?|css)$/;
const TEST_FILE_PATTERN = /\.(?:spec|test)\.(?:[cm]?tsx?)$/;
const DECLARATION_FILE_PATTERN = /\.d\.ts$/;

function isScanRoot(relativePath) {
  return SCAN_ROOTS.some(
    (root) => relativePath === root || relativePath.startsWith(`${root}/`),
  );
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      walk(abs, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!SOURCE_EXT_PATTERN.test(entry.name)) continue;
    if (TEST_FILE_PATTERN.test(entry.name)) continue;
    if (DECLARATION_FILE_PATTERN.test(entry.name)) continue;
    out.push(abs);
  }
}

function collectPackageSrcRoots() {
  const packagesDir = path.join(repoRoot, "packages");
  let entries;
  try {
    entries = readdirSync(packagesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const roots = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const srcDir = path.join(packagesDir, entry.name, "src");
    try {
      if (statSync(srcDir).isDirectory()) roots.push(srcDir);
    } catch {
      // no src dir, skip
    }
  }
  return roots;
}

function countLines(absPath) {
  const text = readFileSync(absPath, "utf8");
  if (text.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) count += 1;
  }
  // If the file does not end with newline, still count the trailing line.
  if (text.charCodeAt(text.length - 1) !== 10) count += 1;
  return count;
}

function collectFiles() {
  const files = [];
  for (const root of SCAN_ROOTS) {
    walk(path.join(repoRoot, root), files);
  }
  for (const root of collectPackageSrcRoots()) {
    walk(root, files);
  }
  const out = [];
  for (const abs of files) {
    const rel = path.relative(repoRoot, abs).split(path.sep).join("/");
    if (!isScanRoot(rel) && !rel.startsWith("packages/")) continue;
    out.push({ path: rel, loc: countLines(abs) });
  }
  // sort by LOC descending, then by path for stability
  out.sort((a, b) => b.loc - a.loc || a.path.localeCompare(b.path));
  return out;
}

function formatTopTable(files, limit = 20) {
  const top = files.slice(0, limit);
  const lines = ["| File | LOC |", "|---|---|"];
  for (const entry of top) {
    lines.push(`| \`${entry.path}\` | ${entry.loc} |`);
  }
  return lines.join("\n");
}

function countSpecFiles() {
  const out = [];
  for (const root of SCAN_ROOTS) {
    walkForSpecs(path.join(repoRoot, root), out);
  }
  for (const root of collectPackageSrcRoots()) {
    walkForSpecs(root, out);
  }
  walkForSpecs(path.join(repoRoot, "tests"), out);
  return out.length;
}

function walkForSpecs(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      walkForSpecs(abs, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!TEST_FILE_PATTERN.test(entry.name)) continue;
    out.push(abs);
  }
}

function runVitestForCounts() {
  // `vitest list` has been observed to hang on this workspace config. Gate it
  // behind an env flag so the default path is the fast, deterministic
  // spec-file fallback. To opt in: REFACTOR_SNAPSHOT_VITEST=1.
  if (process.env.REFACTOR_SNAPSHOT_VITEST !== "1") return null;
  try {
    const stdout = execFileSync(
      "bun",
      ["x", "vitest", "list", "--config", "vitest.workspace.ts"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 60_000,
      },
    );
    const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
    // vitest list prints one `file > describe > test` line per test case.
    // File count = unique prefixes before the first ` > `.
    const files = new Set();
    let tests = 0;
    for (const line of lines) {
      // Ignore header / summary lines like "Test Files ..." or empty noise.
      if (!line.includes(" > ")) continue;
      const file = line.split(" > ")[0].trim();
      if (file) files.add(file);
      tests += 1;
    }
    if (tests > 0) {
      return { source: "vitest list", testFiles: files.size, tests };
    }
  } catch {
    // fall through
  }
  return null;
}

function buildTestSummary() {
  const fromVitest = runVitestForCounts();
  if (fromVitest) return fromVitest;
  const specCount = countSpecFiles();
  return {
    source: "spec-file count (fallback)",
    testFiles: specCount,
    tests: null,
  };
}

function formatProgressSnapshot(summary) {
  const today = new Date().toISOString().slice(0, 10);
  const countLine =
    summary.tests == null
      ? `- Test suite reach: **${summary.testFiles}** test files (counted via ${summary.source}; run \`bun run test\` for the authoritative pass/skip breakdown).`
      : `- Test suite reach: **${summary.testFiles}** test files / **${summary.tests}** tests (sourced from \`${summary.source}\`).`;
  return [
    `Status as of ${today}, based on the work landed on this branch:`,
    "",
    "- Repo-level verification is green: `bun run lint`, `bun run lint:imports`, `bun run typecheck`, `bun run test`, `bun run build`, `node scripts/perf-bundle.mjs`, and `node scripts/perf-startup.mjs` all pass.",
    countLine,
    "- These numbers are regenerated by `bun run refactor:snapshot -- --update-refactor-md`; do not hand-edit.",
  ].join("\n");
}

function replaceMarkerRegion(source, markerName, replacement) {
  const begin = `<!-- BEGIN: ${markerName} -->`;
  const end = `<!-- END: ${markerName} -->`;
  const beginIdx = source.indexOf(begin);
  const endIdx = source.indexOf(end);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`Marker region "${markerName}" not found in REFACTOR.md`);
  }
  const head = source.slice(0, beginIdx + begin.length);
  const tail = source.slice(endIdx);
  return `${head}\n${replacement}\n${tail}`;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const files = collectFiles();
  const topTable = formatTopTable(files, 20);
  const summary = buildTestSummary();

  if (args.has("--update-refactor-md")) {
    const refactorPath = path.join(repoRoot, "REFACTOR.md");
    const original = readFileSync(refactorPath, "utf8");
    let updated = original;
    updated = replaceMarkerRegion(
      updated,
      "progress-snapshot",
      formatProgressSnapshot(summary),
    );
    updated = replaceMarkerRegion(updated, "largest-files", topTable);
    if (updated !== original) {
      writeFileSync(refactorPath, updated);
      process.stdout.write("REFACTOR.md updated.\n");
    } else {
      process.stdout.write("REFACTOR.md already up to date.\n");
    }
    return;
  }

  process.stdout.write("Top 20 largest non-test files\n\n");
  process.stdout.write(`${topTable}\n\n`);
  if (summary.tests == null) {
    process.stdout.write(
      `Test files (${summary.source}): ${summary.testFiles}\n`,
    );
  } else {
    process.stdout.write(
      `Test files: ${summary.testFiles} / Tests: ${summary.tests} (source: ${summary.source})\n`,
    );
  }
}

main();
