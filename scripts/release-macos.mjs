#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasNotarizationCredentials,
  withBuildHeap,
} from "./release-helpers.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

export function hasKeychainDeveloperId() {
  const result = spawnSync(
    "security",
    ["find-identity", "-v", "-p", "codesigning"],
    { encoding: "utf8" },
  );
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.includes(
    "Developer ID Application",
  );
}

export function hasSigningMaterial(env = process.env) {
  return Boolean(env.CSC_LINK) || hasKeychainDeveloperId();
}

function runRelease() {
  const signing = hasSigningMaterial();
  if (signing && !hasNotarizationCredentials()) {
    fail(
      "Missing Apple notarization credentials. Configure APPLE_ID credentials, Notary API credentials, or APPLE_KEYCHAIN_PROFILE.",
    );
  }
  if (!signing) {
    console.log(
      "No Developer ID signing identity; building an unsigned macOS release.",
    );
  }

  const build = spawnSync(
    "bun",
    ["run", "--filter", "@pi-desktop/desktop", "dist:mac"],
    { cwd: repoRoot, stdio: "inherit", env: withBuildHeap(process.env) },
  );
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }

  const verify = spawnSync(
    "node",
    [path.join(scriptDir, "verify-macos-release.mjs")],
    { cwd: repoRoot, stdio: "inherit", env: withBuildHeap(process.env) },
  );
  process.exit(verify.status ?? 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runRelease();
}
