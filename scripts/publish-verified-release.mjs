#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { githubReleaseEditArgs } from "./release-helpers.mjs";

export const GITHUB_PUBLISHED_RELEASE_TAGS_ARGS = [
  "api",
  "--paginate",
  "repos/{owner}/{repo}/releases?per_page=100",
  "--jq",
  ".[] | select(.draft == false) | .tag_name",
];

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${`${result.stdout ?? ""}${
        result.stderr ?? ""
      }`.trim()}`,
    );
  }
  return result.stdout ?? "";
}

export function parsePublishedReleaseTagLines(stdout) {
  return String(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

export function listPublishedReleaseTags() {
  return parsePublishedReleaseTagLines(
    run("gh", GITHUB_PUBLISHED_RELEASE_TAGS_ARGS),
  );
}

export function publishVerifiedRelease(tag) {
  if (!tag) {
    throw new Error("Usage: publish-verified-release.mjs <tag>");
  }

  const args = githubReleaseEditArgs(tag, listPublishedReleaseTags());
  const result = spawnSync("gh", args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    publishVerifiedRelease(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
