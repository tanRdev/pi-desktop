import { existsSync, readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_RENDERER_DIR = "apps/desktop/src/renderer/src";
const ROOT_MAIN_DIR = "apps/desktop/src/main";
const ROOT_SHARED_DIR = "packages/shared/src";

const SCAN_ROOTS = [ROOT_RENDERER_DIR, ROOT_MAIN_DIR, ROOT_SHARED_DIR];
const SOURCE_FILE_PATTERN = /\.(?:[cm]?ts|tsx)$/;
const IGNORED_FILE_PATTERN = /(?:\.d\.ts|\.(?:spec|test)\.(?:[cm]?ts|tsx))$/;

const builtinModuleNames = new Set(
  builtinModules.flatMap((moduleName) => [
    moduleName,
    moduleName.replace(/^node:/u, ""),
  ]),
);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function shouldScanFile(relativePath) {
  return (
    SOURCE_FILE_PATTERN.test(relativePath) &&
    !IGNORED_FILE_PATTERN.test(relativePath)
  );
}

function classifyImporter(relativePath) {
  if (relativePath.startsWith(`${ROOT_RENDERER_DIR}/`)) {
    return "renderer";
  }

  if (relativePath.startsWith(`${ROOT_MAIN_DIR}/`)) {
    return "main";
  }

  if (relativePath.startsWith(`${ROOT_SHARED_DIR}/`)) {
    return "shared";
  }

  return null;
}

function walkSourceFiles(rootDir, currentRelativeDir) {
  const absoluteDir = path.join(rootDir, currentRelativeDir);
  if (!existsSync(absoluteDir)) {
    return [];
  }

  const filePaths = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = toPosixPath(path.join(currentRelativeDir, entry.name));

    if (entry.isDirectory()) {
      filePaths.push(...walkSourceFiles(rootDir, relativePath));
      continue;
    }

    if (shouldScanFile(relativePath)) {
      filePaths.push(relativePath);
    }
  }

  return filePaths.sort((left, right) => left.localeCompare(right));
}

function countLineNumber(sourceText, characterOffset) {
  return sourceText.slice(0, characterOffset).split("\n").length;
}

function getStatementOffset(matchText, fallbackToken) {
  const importOffset = matchText.search(/\bimport\b/u);
  if (importOffset >= 0) {
    return importOffset;
  }

  const exportOffset = matchText.search(/\bexport\b/u);
  if (exportOffset >= 0) {
    return exportOffset;
  }

  return matchText.indexOf(fallbackToken);
}

function collectImportSpecifiers(sourceText) {
  const matches = [];
  const patterns = [
    /(?:^|[;\n\r])\s*import\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']/gu,
    /(?:^|[;\n\r])\s*export\s+(?:type\s+)?(?:\*\s+from|\{[\s\S]*?\}\s+from)\s*["']([^"']+)["']/gu,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(sourceText);
    while (match !== null) {
      const statementOffset = getStatementOffset(match[0], match[1]);
      matches.push({
        line: countLineNumber(sourceText, match.index + statementOffset),
        specifier: match[1],
      });
      match = pattern.exec(sourceText);
    }
  }

  return matches.sort((left, right) => left.line - right.line);
}

function isElectronImport(specifier) {
  return specifier === "electron" || specifier.startsWith("electron/");
}

function isNodeBuiltinImport(specifier) {
  const normalizedSpecifier = specifier.startsWith("node:")
    ? specifier.slice(5)
    : specifier;

  if (builtinModuleNames.has(normalizedSpecifier)) {
    return true;
  }

  if (normalizedSpecifier.startsWith("@")) {
    return false;
  }

  const packageName = normalizedSpecifier.split("/")[0];
  return builtinModuleNames.has(packageName);
}

function isAgentHostImport(specifier) {
  return (
    specifier === "@pi-desktop/agent-host" ||
    specifier.startsWith("@pi-desktop/agent-host/")
  );
}

function isReactImport(specifier) {
  return (
    specifier === "react" ||
    specifier.startsWith("react/") ||
    specifier === "react-dom" ||
    specifier.startsWith("react-dom/")
  );
}

function isZustandImport(specifier) {
  return specifier === "zustand" || specifier.startsWith("zustand/");
}

function resolveInternalImportTarget(importerRelativePath, specifier) {
  if (specifier.startsWith("@/")) {
    return toPosixPath(
      path.posix.normalize(
        path.posix.join(ROOT_RENDERER_DIR, specifier.slice(2)),
      ),
    );
  }

  if (!specifier.startsWith(".")) {
    return null;
  }

  return toPosixPath(
    path.posix.normalize(
      path.posix.join(path.posix.dirname(importerRelativePath), specifier),
    ),
  );
}

function createViolation(importerKind, filePath, line, rule, specifier) {
  return {
    filePath,
    importerKind,
    line,
    rule,
    specifier,
  };
}

function checkSpecifier(importerKind, importerRelativePath, specifier, line) {
  const resolvedTarget = resolveInternalImportTarget(
    importerRelativePath,
    specifier,
  );

  if (importerKind === "renderer") {
    if (isElectronImport(specifier)) {
      return createViolation(
        importerKind,
        importerRelativePath,
        line,
        "renderer-no-electron",
        specifier,
      );
    }

    if (isNodeBuiltinImport(specifier)) {
      return createViolation(
        importerKind,
        importerRelativePath,
        line,
        "renderer-no-node",
        specifier,
      );
    }

    if (isAgentHostImport(specifier)) {
      return createViolation(
        importerKind,
        importerRelativePath,
        line,
        "renderer-no-agent-host",
        specifier,
      );
    }

    if (resolvedTarget?.startsWith(`${ROOT_MAIN_DIR}/`)) {
      return createViolation(
        importerKind,
        importerRelativePath,
        line,
        "renderer-no-main",
        specifier,
      );
    }

    return null;
  }

  if (importerKind === "main") {
    if (isReactImport(specifier)) {
      return createViolation(
        importerKind,
        importerRelativePath,
        line,
        "main-no-react",
        specifier,
      );
    }

    if (isZustandImport(specifier)) {
      return createViolation(
        importerKind,
        importerRelativePath,
        line,
        "main-no-zustand",
        specifier,
      );
    }

    if (resolvedTarget?.startsWith(`${ROOT_RENDERER_DIR}/`)) {
      return createViolation(
        importerKind,
        importerRelativePath,
        line,
        "main-no-renderer",
        specifier,
      );
    }

    return null;
  }

  if (importerKind === "shared") {
    if (isElectronImport(specifier)) {
      return createViolation(
        importerKind,
        importerRelativePath,
        line,
        "shared-no-electron",
        specifier,
      );
    }

    if (isNodeBuiltinImport(specifier)) {
      return createViolation(
        importerKind,
        importerRelativePath,
        line,
        "shared-no-node",
        specifier,
      );
    }
  }

  return null;
}

export function checkImportBoundaries(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const sourceFiles = SCAN_ROOTS.flatMap((scanRoot) =>
    walkSourceFiles(rootDir, scanRoot),
  );
  const violations = [];

  for (const relativePath of sourceFiles) {
    const importerKind = classifyImporter(relativePath);
    if (importerKind === null) {
      continue;
    }

    const sourceText = readFileSync(path.join(rootDir, relativePath), "utf8");
    const imports = collectImportSpecifiers(sourceText);

    for (const entry of imports) {
      const violation = checkSpecifier(
        importerKind,
        relativePath,
        entry.specifier,
        entry.line,
      );

      if (violation !== null) {
        violations.push(violation);
      }
    }
  }

  return violations.sort((left, right) => {
    if (left.filePath !== right.filePath) {
      return left.filePath.localeCompare(right.filePath);
    }

    if (left.line !== right.line) {
      return left.line - right.line;
    }

    if (left.rule !== right.rule) {
      return left.rule.localeCompare(right.rule);
    }

    return left.specifier.localeCompare(right.specifier);
  });
}

function formatViolation(violation) {
  return `${violation.filePath}:${violation.line} [${violation.rule}] ${violation.specifier}`;
}

function runCli() {
  const rootDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : process.cwd();
  const violations = checkImportBoundaries({ rootDir });

  if (violations.length === 0) {
    console.log("Import boundary check passed.");
    return;
  }

  console.error("Import boundary violations found:");
  for (const violation of violations) {
    console.error(`- ${formatViolation(violation)}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
