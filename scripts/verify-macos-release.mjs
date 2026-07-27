#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const version = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
).version;
const appPath = path.join(
  repoRoot,
  "dist",
  "release",
  "mac-arm64",
  "Pi Desktop.app",
);
const dmgPath = path.join(
  repoRoot,
  "dist",
  "release",
  `Pi Desktop-${version}-arm64.dmg`,
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed${output ? `:\n${output}` : ""}`,
    );
  }
  return output;
}

for (const target of [appPath, dmgPath]) {
  if (!existsSync(target)) {
    throw new Error(`Missing release artifact: ${target}`);
  }
}

run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
const signature = run("codesign", ["-dv", "--verbose=4", appPath]);
if (
  signature.includes("Signature=adhoc") ||
  signature.includes("TeamIdentifier=not set") ||
  !signature.includes("Authority=Developer ID Application")
) {
  throw new Error(
    "Release app is not signed with a Developer ID Application certificate.",
  );
}

run("xcrun", ["stapler", "validate", appPath]);
run("xcrun", ["stapler", "validate", dmgPath]);
run("spctl", ["--assess", "--type", "execute", "--verbose=4", appPath]);
run("spctl", [
  "--assess",
  "--type",
  "open",
  "--context",
  "context:primary-signature",
  "--verbose=4",
  dmgPath,
]);

console.log(`✅ Verified signed and notarized Pi Desktop ${version} release.`);
