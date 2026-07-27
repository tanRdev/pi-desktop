#!/usr/bin/env node
/**
 * Upload electron-builder artifacts to an existing GitHub release with the
 * hyphenated names electron-updater expects (from latest-mac.yml).
 *
 * Usage:
 *   bun scripts/publish-github-release-assets.mjs [tag]
 *
 * Defaults tag to v${package.json version}. Requires `gh` auth.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const releaseDir = path.join(repoRoot, "dist", "release");
const version = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
).version;
const tag = process.argv[2] ?? `v${version}`;
const expectedTag = `v${version}`;

if (tag !== expectedTag) {
  throw new Error(
    `Refusing to publish ${version} artifacts to ${tag}; expected ${expectedTag}.`,
  );
}

if (!existsSync(releaseDir)) {
  throw new Error(`Missing ${releaseDir}. Run release:mac first.`);
}

const latestMac = path.join(releaseDir, "latest-mac.yml");
if (!existsSync(latestMac)) {
  throw new Error(
    `Missing ${latestMac}. electron-builder must emit updater metadata.`,
  );
}

const verification = spawnSync(
  "node",
  [path.join(scriptDir, "verify-macos-release.mjs")],
  { stdio: "inherit", cwd: repoRoot, env: process.env },
);
if (verification.status !== 0) {
  throw new Error(
    "Refusing to upload a release that did not pass macOS signing and notarization verification.",
  );
}

/** Map "Pi Desktop-0.8.0-arm64.dmg" → "Pi-Desktop-0.8.0-arm64.dmg" */
function hyphenateProductName(fileName) {
  return fileName.replace(/^Pi Desktop/, "Pi-Desktop");
}

const uploads = [latestMac];
const versionPrefix = `Pi Desktop-${version}-`;
for (const name of readdirSync(releaseDir)) {
  if (!name.startsWith(versionPrefix)) continue;
  if (!/\.(dmg|zip)(\.blockmap)?$/.test(name)) continue;
  const source = path.join(releaseDir, name);
  const destName = hyphenateProductName(name);
  const dest = path.join(releaseDir, destName);
  if (source !== dest) {
    copyFileSync(source, dest);
  }
  uploads.push(dest);
}

const unique = [...new Set(uploads)];
console.log(`Uploading ${unique.length} assets to ${tag}…`);
const result = spawnSync(
  "gh",
  ["release", "upload", tag, "--clobber", ...unique],
  { stdio: "inherit", cwd: repoRoot },
);
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
console.log(`✅ Release ${tag} updater assets published.`);
