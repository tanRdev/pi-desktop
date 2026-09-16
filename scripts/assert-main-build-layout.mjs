#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SESSION_SERVER_PATTERN = /^agent-host-session-server-entry-[^./]+\.js$/;

export function assertMainProcessLayout(mainOutDir) {
  const indexPath = path.join(mainOutDir, "index.js");
  if (!existsSync(indexPath)) {
    throw new Error(`Missing main entry: ${indexPath}`);
  }
  const indexSource = readFileSync(indexPath, "utf8");
  if (indexSource.trim().length === 0) {
    throw new Error(`Main entry is empty: ${indexPath}`);
  }

  const chunksDir = path.join(mainOutDir, "chunks");
  if (existsSync(chunksDir)) {
    throw new Error(
      `Shared main-process chunks directory exists: ${chunksDir}`,
    );
  }

  const sessionFiles = readdirSync(mainOutDir).filter((name) =>
    SESSION_SERVER_PATTERN.test(name),
  );
  if (sessionFiles.length === 0) {
    throw new Error(
      `Missing ?modulePath session-server bundle under ${mainOutDir}`,
    );
  }

  const referenced = sessionFiles.filter((fileName) => {
    const relative = `./${fileName}`;
    return (
      indexSource.includes(JSON.stringify(relative)) ||
      indexSource.includes(relative)
    );
  });
  if (referenced.length === 0) {
    throw new Error(
      `Main entry does not reference a session-server bundle (${sessionFiles.join(", ")})`,
    );
  }

  for (const fileName of referenced) {
    const sessionPath = path.join(mainOutDir, fileName);
    if (readFileSync(sessionPath, "utf8").trim().length === 0) {
      throw new Error(`Session-server bundle is empty: ${sessionPath}`);
    }
  }

  return {
    indexPath,
    sessionFiles: referenced,
  };
}

function runCli(argv) {
  const target = argv[0];
  if (!target) {
    throw new Error("Usage: assert-main-build-layout.mjs <main-out-dir>");
  }
  const resolved = path.resolve(target);
  const result = assertMainProcessLayout(resolved);
  console.log(
    `Main process layout OK: ${result.indexPath} -> ${result.sessionFiles.join(", ")}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
