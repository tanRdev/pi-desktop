#!/usr/bin/env node
/**
 * Contract coverage gate.
 *
 * Default (strict): fails if any live IPC channel lacks a Contract registration.
 * Migration mode: set CONTRACT_COVERAGE_MIGRATION=1 to report undeclared channels
 * and exit 0 unless coverage falls below CONTRACT_COVERAGE_MIN (default 0).
 *
 * Compares registered Contracts against IPC_CHANNELS (+ updates orphans).
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function flattenChannels(node, out = []) {
  if (typeof node === "string") {
    out.push(node);
    return out;
  }
  if (node && typeof node === "object") {
    for (const value of Object.values(node)) {
      flattenChannels(value, out);
    }
  }
  return out;
}

async function main() {
  const sharedPath = path.join(rootDir, "packages/shared/src/ipc/channels.ts");
  const contractsEntry = path.join(rootDir, "packages/contracts/src/index.ts");

  // Prefer TypeScript sources via dynamic import (vitest/bun resolve .ts).
  const shared = await import(
    pathToFileUrl(path.join(rootDir, "packages/shared/src/index.ts"))
  );
  const contracts = await import(pathToFileUrl(contractsEntry));

  const liveChannels = [...flattenChannels(shared.IPC_CHANNELS)].sort();

  const registered = new Set(contracts.getRegisteredContractChannels());
  const undeclared = liveChannels.filter((channel) => !registered.has(channel));
  const coverage =
    liveChannels.length === 0
      ? 1
      : (liveChannels.length - undeclared.length) / liveChannels.length;

  const minCoverage = Number(process.env.CONTRACT_COVERAGE_MIN ?? "0");
  const migrationMode = process.env.CONTRACT_COVERAGE_MIGRATION === "1";
  const strict = !migrationMode;

  console.log(
    `Contract coverage: ${registered.size}/${liveChannels.length} (${(coverage * 100).toFixed(1)}%)`,
  );
  if (undeclared.length > 0) {
    console.log(`Undeclared channels (${undeclared.length}):`);
    for (const channel of undeclared) {
      console.log(`  - ${channel}`);
    }
  }

  if (strict && undeclared.length > 0) {
    console.error(
      "Contract coverage gate: failing because undeclared channels remain (set CONTRACT_COVERAGE_MIGRATION=1 for migration mode).",
    );
    process.exit(1);
  }

  if (coverage < minCoverage) {
    console.error(
      `Coverage ${(coverage * 100).toFixed(1)}% is below CONTRACT_COVERAGE_MIN=${minCoverage * 100}%.`,
    );
    process.exit(1);
  }

  // Touch paths so unused-import linters don't complain when refactoring this script.
  void sharedPath;
  void require;
}

function pathToFileUrl(filePath) {
  const resolved = path.resolve(filePath);
  return `file://${resolved}`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
