import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const JS_FILE_PATTERN = /\.(?:[cm]?js)$/;
const RELATIVE_SPECIFIER_PATTERN =
  /(?:import|export)\s+["'](\.[^"']+)["']|(?:import|export)(?:\s+type)?(?:\s*\{[^}]*\}|\s+\*\s+as\s+[\w$]+|\s+\*|[\s\w*,]+)\s*from\s*["'](\.[^"']+)["']|import\s*\(\s*["'](\.[^"']+)["']\s*\)/g;
const NAMED_FROM_PATTERN =
  /(?:import|export)\s*\{([^}]*)\}\s*from\s*["'](\.[^"']+)["']/g;

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

export function asarEntryPath(listedPath) {
  return toPosixPath(listedPath).replace(/^\/+/, "");
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
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

function parseImportedNames(clause) {
  return clause
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== "type")
    .map((part) => {
      const normalized = part.replace(/^type\s+/, "").trim();
      const [exportedName] = normalized.split(/\s+as\s+/);
      return exportedName?.trim();
    })
    .filter((name) => Boolean(name) && name !== "...");
}

function extractNamedImports(source) {
  const namedImports = [];
  for (const match of source.matchAll(NAMED_FROM_PATTERN)) {
    const specifier = match[2];
    const names = parseImportedNames(match[1] ?? "");
    if (specifier && names.length > 0) {
      namedImports.push({ specifier, names });
    }
  }
  return namedImports;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function moduleExportsName(source, name) {
  if (name === "default") {
    return /\bexport\s+default\b/.test(source);
  }
  if (/\bexport\s+\*\s+from\b/.test(source)) {
    return true;
  }
  const escaped = escapeRegExp(name);
  return (
    new RegExp(
      `\\bexport\\s+(?:async\\s+)?(?:function\\*?|class)\\s+${escaped}\\b`,
    ).test(source) ||
    new RegExp(`\\bexport\\s+(?:const|let|var)\\s+${escaped}\\b`).test(
      source,
    ) ||
    new RegExp(`\\bexport\\s*\\{[^}]*\\b${escaped}\\b`).test(source)
  );
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
 * Inspect a JavaScript module graph for empty files, dangling relative ESM
 * imports, and named imports that the target module does not export.
 * `files` is a map of posix-relative path → file bytes.
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

    for (const { specifier, names } of extractNamedImports(source)) {
      const target = resolveRelativeImport(relativePath, specifier);
      if (!target || !(target in files) || isEmptyBytes(files[target])) {
        continue;
      }
      const targetSource = files[target].toString("utf8");
      for (const name of names) {
        if (!moduleExportsName(targetSource, name)) {
          problems.push({
            kind: "missing-export",
            file: relativePath,
            detail: `imports ${name} from ${specifier} but that export is missing`,
          });
        }
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
  if (Object.keys(files).length === 0) {
    throw new Error(`No JavaScript files found under ${rootDir}`);
  }
  return inspectJavaScriptGraph(files);
}

function loadAsarModule(fromDir) {
  const require = createRequire(import.meta.url);
  try {
    return require("@electron/asar");
  } catch {
    const resolved = require.resolve("@electron/asar", {
      paths: [
        fromDir,
        path.join(fromDir, "apps", "desktop"),
        path.join(fromDir, "node_modules", "electron-builder"),
      ],
    });
    return require(resolved);
  }
}

export function inspectAsar(asarPath, resolveFrom = process.cwd()) {
  if (!existsSync(asarPath)) {
    throw new Error(`Missing asar archive: ${asarPath}`);
  }
  const asar = loadAsarModule(resolveFrom);
  const listed = asar.listPackage(asarPath);
  const files = {};
  const extractErrors = [];
  for (const listedPath of listed) {
    const relativePath = asarEntryPath(listedPath);
    if (!JS_FILE_PATTERN.test(relativePath)) {
      continue;
    }
    try {
      files[relativePath] = asar.extractFile(asarPath, relativePath);
    } catch (error) {
      extractErrors.push(
        `${relativePath}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  if (extractErrors.length > 0) {
    throw new Error(
      `Failed to read JavaScript from ${asarPath}:\n${extractErrors
        .map((line) => `- ${line}`)
        .join("\n")}`,
    );
  }
  if (Object.keys(files).length === 0) {
    throw new Error(`No JavaScript files found in ${asarPath}`);
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
