import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

// Get node-pty version from actual dependencies
const nodePtyVersion = desktopPackageJson.dependencies?.["node-pty"] || "1.1.0";

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

// Copy build output and native dependencies
cpSync(outDir, path.join(stageDir, "out"), { recursive: true });
cpSync(nodePtyDir, path.join(stageDir, "node_modules", "node-pty"), {
  recursive: true,
});

// Create release package.json with values from source
const releasePackageJson = {
  name: "@pi-desktop/desktop-release",
  version,
  main,
  dependencies: {
    "node-pty": nodePtyVersion,
  },
};

writeFileSync(
  path.join(stageDir, "package.json"),
  `${JSON.stringify(releasePackageJson, null, 2)}\n`,
);

console.log(`✅ Staged desktop release v${version} to ${stageDir}`);
