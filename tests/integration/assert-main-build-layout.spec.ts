import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { assertMainProcessLayout } from "../../scripts/assert-main-build-layout.mjs";

const tempRoots: string[] = [];

function createFixtureRoot(): string {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "pi-main-layout-"));
  tempRoots.push(fixtureRoot);
  return fixtureRoot;
}

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("assertMainProcessLayout", () => {
  it("accepts an isolated index that references the modulePath session server", () => {
    const mainOutDir = createFixtureRoot();
    writeFileSync(
      path.join(mainOutDir, "index.js"),
      'import { join } from "path";\nexport default join(import.meta.dirname, "./agent-host-session-server-entry-abc123.js");\n',
    );
    writeFileSync(
      path.join(mainOutDir, "agent-host-session-server-entry-abc123.js"),
      "export const start = 1;\n",
    );

    expect(assertMainProcessLayout(mainOutDir)).toEqual({
      indexPath: path.join(mainOutDir, "index.js"),
      sessionFiles: ["agent-host-session-server-entry-abc123.js"],
    });
  });

  it("rejects a missing session-server reference", () => {
    const mainOutDir = createFixtureRoot();
    writeFileSync(
      path.join(mainOutDir, "index.js"),
      "export const main = 1;\n",
    );
    writeFileSync(
      path.join(mainOutDir, "agent-host-session-server-entry-abc123.js"),
      "export const start = 1;\n",
    );

    expect(() => assertMainProcessLayout(mainOutDir)).toThrow(
      /does not reference a session-server bundle/,
    );
  });

  it("rejects the shared chunks directory even when it is empty", () => {
    const mainOutDir = createFixtureRoot();
    mkdirSync(path.join(mainOutDir, "chunks"));
    writeFileSync(
      path.join(mainOutDir, "index.js"),
      'import { join } from "path";\nexport default join(import.meta.dirname, "./agent-host-session-server-entry-abc123.js");\n',
    );
    writeFileSync(
      path.join(mainOutDir, "agent-host-session-server-entry-abc123.js"),
      "export const start = 1;\n",
    );
    expect(() => assertMainProcessLayout(mainOutDir)).toThrow(
      /Shared main-process chunks/,
    );
  });
});
