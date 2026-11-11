import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertJavaScriptGraph,
  inspectDirectory,
} from "./inspect-packaged-js.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const desktopDir = path.join(repoRoot, "apps", "desktop");
const stageDir = path.join(repoRoot, "dist", "electron-app");
const outDir = path.join(desktopDir, "out");
const nodePtyDir = path.join(desktopDir, "node_modules", "node-pty");

// Read desktop package.json for all source values
const desktopPackageJson = JSON.parse(
  readFileSync(path.join(desktopDir, "package.json"), "utf-8"),
);

// Also read root package.json to ensure versions are in sync
const rootPackageJson = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf-8"),
);

// Ensure versions match
if (rootPackageJson.version !== desktopPackageJson.version) {
  console.warn(
    `⚠️  Version mismatch: root is ${rootPackageJson.version}, desktop is ${desktopPackageJson.version}`,
  );
  console.warn("   Consider running: npm version <version> --workspaces");
}

// Extract values from desktop package.json
const version = desktopPackageJson.version;
const main = desktopPackageJson.main || "out/main/index.js";

// Keep external runtime packages and their installed dependency trees.
const runtimeDependencyNames = [
  "node-pty",
  "@earendil-works/pi-coding-agent",
  "electron-updater",
  "sharp",
];
const runtimeDependencies = Object.fromEntries(
  runtimeDependencyNames.map((name) => [
    name,
    desktopPackageJson.dependencies[name],
  ]),
);

// Preserve each dependency's own resolution context (including optional native
// packages). All links target copied packages inside the release directory.
const copiedPackages = new Map();
function findPackage(name, fromDir) {
  for (let current = fromDir; ; current = path.dirname(current)) {
    const candidate = path.join(current, "node_modules", name);
    if (existsSync(path.join(candidate, "package.json")))
      return realpathSync(candidate);
    if (path.dirname(current) === current) return null;
  }
}
function copyPackage(name, fromDir, destinationModules, optional = false) {
  const source = findPackage(name, fromDir);
  if (!source) {
    if (optional) return;
    throw new Error(
      `Missing runtime dependency ${name} required by ${fromDir}`,
    );
  }
  const destination = path.join(destinationModules, name);
  mkdirSync(path.dirname(destination), { recursive: true });
  const existing = copiedPackages.get(source);
  if (existing) {
    symlinkSync(
      path.relative(path.dirname(destination), existing),
      destination,
      "dir",
    );
    return;
  }
  copiedPackages.set(source, destination);
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source)) {
    if (entry !== "node_modules")
      cpSync(path.join(source, entry), path.join(destination, entry), {
        recursive: true,
        dereference: true,
      });
  }
  const manifest = JSON.parse(
    readFileSync(path.join(source, "package.json"), "utf8"),
  );
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
  };
  for (const dependency of Object.keys(dependencies)) {
    copyPackage(
      dependency,
      source,
      path.join(destination, "node_modules"),
      dependency in (manifest.optionalDependencies ?? {}),
    );
  }
}

// Validate required directories exist
if (!existsSync(outDir)) {
  throw new Error(`Desktop build output not found at ${outDir}`);
}

if (!existsSync(nodePtyDir)) {
  throw new Error(`node-pty not found at ${nodePtyDir}`);
}

// Clean and recreate stage directory
console.log(`📦 Staging desktop release v${version}...`);
rmSync(stageDir, { force: true, recursive: true });
mkdirSync(path.join(stageDir, "node_modules"), { recursive: true });

assertJavaScriptGraph(
  inspectDirectory(outDir),
  `Desktop build output at ${outDir}`,
);

// Copy build output and native dependencies
cpSync(outDir, path.join(stageDir, "out"), { recursive: true });
for (const name of runtimeDependencyNames) {
  copyPackage(name, desktopDir, path.join(stageDir, "node_modules"));
}

// Create release package.json with values from source
const releasePackageJson = {
  name: "@pi-desktop/desktop-release",
  type: "module",
  version,
  main,
  dependencies: runtimeDependencies,
};

writeFileSync(
  path.join(stageDir, "package.json"),
  `${JSON.stringify(releasePackageJson, null, 2)}\n`,
);

console.log(`✅ Staged desktop release v${version} to ${stageDir}`);
