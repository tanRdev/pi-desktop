#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { shouldMarkReleaseLatest } from "./release-helpers.mjs";

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

function publishVerifiedRelease(tag) {
  if (!tag) {
    throw new Error("Usage: publish-verified-release.mjs <tag>");
  }

  const listed = JSON.parse(
    run("gh", [
      "release",
      "list",
      "--exclude-drafts",
      "--limit",
      "50",
      "--json",
      "tagName",
    ]) || "[]",
  );
  const publishedTags = listed.map((release) => release.tagName);
  const args = ["release", "edit", tag, "--draft=false"];
  if (shouldMarkReleaseLatest(tag, publishedTags)) {
    args.push("--latest");
  }
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
