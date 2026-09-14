import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const JS_FILE_PATTERN = /\.(?:[cm]?js)$/;
const RELATIVE_SPECIFIER_PATTERN =
  /(?:import|export)\s+(?:[^'"\n;]*?\sfrom\s+)?["'](\.[^"']+)["']|import\s*\(\s*["'](\.[^"']+)["']\s*\)/g;

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function walkJsFiles(rootDir, currentRelativeDir = "") {
  const absoluteDir = path.join(rootDir, currentRelativeDir);
  if (!existsSync(absoluteDir)) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = toPosixPath(path.join(currentRelativeDir, entry.name));
    if (entry.isDirectory()) {
      files.push(...walkJsFiles(rootDir, relativePath));
      continue;
    }
    if (JS_FILE_PATTERN.test(entry.name)) {
      files.push(relativePath);
    }
  }
  return files;
}

function extractRelativeSpecifiers(source) {
  const specifiers = [];
  for (const match of source.matchAll(RELATIVE_SPECIFIER_PATTERN)) {
    const specifier = match[1] ?? match[2];
    if (specifier) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

function isEmptyBytes(bytes) {
  return bytes.length === 0 || bytes.toString("utf8").trim().length === 0;
}

function resolveRelativeImport(fromRelativePath, specifier) {
  const fromDir = path.posix.dirname(fromRelativePath);
  const resolved = path.posix.normalize(path.posix.join(fromDir, specifier));
  return resolved.startsWith("../") ? null : resolved;
}

/**
 * Inspect a JavaScript module graph for empty files and dangling relative ESM
 * imports. `files` is a map of posix-relative path → file bytes.
 */
export function inspectJavaScriptGraph(files) {
  const problems = [];

  for (const [relativePath, bytes] of Object.entries(files)) {
    if (isEmptyBytes(bytes)) {
      problems.push({
        kind: "empty",
        file: relativePath,
        detail: "file is empty",
      });
      continue;
    }

    const source = bytes.toString("utf8");
    for (const specifier of extractRelativeSpecifiers(source)) {
      const target = resolveRelativeImport(relativePath, specifier);
      if (!target) {
        problems.push({
          kind: "missing-import",
          file: relativePath,
          detail: `relative import ${specifier} escapes the inspect root`,
        });
        continue;
      }
      if (!(target in files)) {
        problems.push({
          kind: "missing-import",
          file: relativePath,
          detail: `imports ${specifier} but ${target} is not in the package`,
        });
        continue;
      }
      if (isEmptyBytes(files[target])) {
        problems.push({
          kind: "empty-import",
          file: relativePath,
          detail: `imports ${specifier} which is empty`,
        });
      }
    }
  }

  return problems;
}

export function inspectDirectory(rootDir) {
  const files = {};
  for (const relativePath of walkJsFiles(rootDir)) {
    files[relativePath] = readFileSync(path.join(rootDir, relativePath));
  }
  return inspectJavaScriptGraph(files);
}

function loadAsarModule(fromDir) {
  const require = createRequire(import.meta.url);
  const resolved = require.resolve("@electron/asar", {
    paths: [
      fromDir,
      path.join(fromDir, "apps", "desktop"),
      path.join(fromDir, "node_modules", "electron-builder"),
    ],
  });
  return require(resolved);
}

export function inspectAsar(asarPath, resolveFrom = process.cwd()) {
  if (!existsSync(asarPath)) {
    throw new Error(`Missing asar archive: ${asarPath}`);
  }
  const asar = loadAsarModule(resolveFrom);
  const listed = asar.listPackage(asarPath);
  const files = {};
  for (const listedPath of listed) {
    const relativePath = toPosixPath(listedPath).replace(/^\/+/, "");
    if (!JS_FILE_PATTERN.test(relativePath)) {
      continue;
    }
    files[relativePath] = asar.extractFile(asarPath, listedPath);
  }
  return inspectJavaScriptGraph(files);
}

export function formatProblems(problems) {
  return problems
    .map((problem) => `- ${problem.file}: ${problem.detail}`)
    .join("\n");
}

export function assertJavaScriptGraph(problems, label) {
  if (problems.length === 0) {
    return;
  }
  throw new Error(
    `${label} has a broken JavaScript graph:\n${formatProblems(problems)}`,
  );
}

function runCli(argv) {
  const target = argv[0];
  if (!target) {
    throw new Error("Usage: inspect-packaged-js.mjs <directory-or-asar>");
  }
  const resolved = path.resolve(target);
  const problems = resolved.endsWith(".asar")
    ? inspectAsar(resolved)
    : inspectDirectory(resolved);
  assertJavaScriptGraph(problems, resolved);
  console.log(`JavaScript graph OK: ${resolved}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
