import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";
import {
  createPreCommitPlan,
  formatCommand,
  loadWorkspaceMetadata,
} from "./pre-commit-helpers.mjs";

function readStagedFiles() {
  const simulatedFiles = process.env.PI_PRECOMMIT_STAGED_FILES;
  if (simulatedFiles !== undefined) {
    return simulatedFiles
      .split(/\r?\n|,/u)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  return output
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function printDryRun(plan) {
  console.log("Dry run: pre-commit plan");

  if (plan.biomeFiles.length === 0) {
    console.log("- Skip Biome: no staged files match the formatter inputs");
  } else {
    console.log(
      `- ${formatCommand("bunx", ["biome", "check", "--write", ...plan.biomeFiles])}`,
    );
  }

  if (plan.typecheck.strategy === "none") {
    console.log(
      "- Skip typecheck: staged files do not affect typed workspaces",
    );
    return;
  }

  if (plan.typecheck.strategy === "root") {
    console.log(`- ${formatCommand("bun", ["run", "typecheck"])}`);
    return;
  }

  for (const workspaceName of plan.typecheck.workspaceNames) {
    console.log(
      `- ${formatCommand("bun", ["run", "--filter", workspaceName, "typecheck"])}`,
    );
  }
}

function main() {
  const rootDir = process.cwd();
  const stagedFiles = readStagedFiles();

  if (stagedFiles.length === 0) {
    console.log("No staged files to validate.");
    return;
  }

  const plan = createPreCommitPlan({
    stagedFiles,
    workspaces: loadWorkspaceMetadata(rootDir),
  });

  if (process.env.PI_PRECOMMIT_DRY_RUN === "1") {
    printDryRun(plan);
    return;
  }

  if (plan.biomeFiles.length > 0) {
    runCommand("bunx", ["biome", "check", "--write", ...plan.biomeFiles]);
    runCommand("git", ["add", ...plan.biomeFiles]);
  }

  if (plan.typecheck.strategy === "root") {
    runCommand("bun", ["run", "typecheck"]);
    return;
  }

  if (plan.typecheck.strategy === "workspace") {
    for (const workspaceName of plan.typecheck.workspaceNames) {
      runCommand("bun", ["run", "--filter", workspaceName, "typecheck"]);
    }
  }
}

main();
