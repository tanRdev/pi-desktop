#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function hasKeychainDeveloperId() {
  const result = spawnSync(
    "security",
    ["find-identity", "-v", "-p", "codesigning"],
    { encoding: "utf8" },
  );
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.includes(
    "Developer ID Application",
  );
}

const hasSigningMaterial =
  Boolean(process.env.CSC_LINK) || hasKeychainDeveloperId();
if (!hasSigningMaterial) {
  fail(
    "Missing Developer ID Application signing identity. Set CSC_LINK and CSC_KEY_PASSWORD or install the certificate in the login keychain.",
  );
}

const hasAppleIdCredentials =
  Boolean(process.env.APPLE_ID) &&
  Boolean(process.env.APPLE_APP_SPECIFIC_PASSWORD) &&
  Boolean(process.env.APPLE_TEAM_ID);
const hasApiKeyCredentials =
  Boolean(process.env.APPLE_API_KEY) &&
  Boolean(process.env.APPLE_API_KEY_ID) &&
  Boolean(process.env.APPLE_API_ISSUER);
const hasKeychainProfile = Boolean(process.env.APPLE_KEYCHAIN_PROFILE);

if (!hasAppleIdCredentials && !hasApiKeyCredentials && !hasKeychainProfile) {
  fail(
    "Missing Apple notarization credentials. Configure APPLE_ID credentials, Notary API credentials, or APPLE_KEYCHAIN_PROFILE.",
  );
}

const build = spawnSync(
  "bun",
  ["run", "--filter", "@pi-desktop/desktop", "dist:mac"],
  { cwd: repoRoot, stdio: "inherit", env: process.env },
);
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const verify = spawnSync(
  "node",
  [path.join(scriptDir, "verify-macos-release.mjs")],
  { cwd: repoRoot, stdio: "inherit", env: process.env },
);
process.exit(verify.status ?? 1);
