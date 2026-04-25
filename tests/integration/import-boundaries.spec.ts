import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkImportBoundaries } from "../../scripts/check-import-boundaries.mjs";

const tempRoots: string[] = [];

function createFixtureRoot(): string {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "pi-import-boundaries-"));
  tempRoots.push(fixtureRoot);
  return fixtureRoot;
}

function writeFixtureFile(
  rootDir: string,
  relativePath: string,
  content: string,
): void {
  const filePath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("checkImportBoundaries", () => {
  it("reports forbidden renderer imports", () => {
    const rootDir = createFixtureRoot();

    writeFixtureFile(
      rootDir,
      "apps/desktop/src/renderer/src/forbidden.ts",
      [
        'import { shell } from "electron";',
        'import { readFileSync } from "node:fs";',
        'import { startAgent } from "@pi-desktop/agent-host";',
        'import { launchMain } from "../../main/index";',
      ].join("\n"),
    );

    expect(checkImportBoundaries({ rootDir })).toEqual([
      {
        filePath: "apps/desktop/src/renderer/src/forbidden.ts",
        importerKind: "renderer",
        line: 1,
        rule: "renderer-no-electron",
        specifier: "electron",
      },
      {
        filePath: "apps/desktop/src/renderer/src/forbidden.ts",
        importerKind: "renderer",
        line: 2,
        rule: "renderer-no-node",
        specifier: "node:fs",
      },
      {
        filePath: "apps/desktop/src/renderer/src/forbidden.ts",
        importerKind: "renderer",
        line: 3,
        rule: "renderer-no-agent-host",
        specifier: "@pi-desktop/agent-host",
      },
      {
        filePath: "apps/desktop/src/renderer/src/forbidden.ts",
        importerKind: "renderer",
        line: 4,
        rule: "renderer-no-main",
        specifier: "../../main/index",
      },
    ]);
  });

  it("reports forbidden main imports", () => {
    const rootDir = createFixtureRoot();

    writeFixtureFile(
      rootDir,
      "apps/desktop/src/main/forbidden.ts",
      [
        'import * as React from "react";',
        'import { createPortal } from "react-dom";',
        'import { createStore } from "zustand/vanilla";',
        'import { App } from "@/app";',
        'import { WorkspaceShell } from "../renderer/src/features/workspace/components/workspace-shell";',
      ].join("\n"),
    );

    expect(checkImportBoundaries({ rootDir })).toEqual([
      {
        filePath: "apps/desktop/src/main/forbidden.ts",
        importerKind: "main",
        line: 1,
        rule: "main-no-react",
        specifier: "react",
      },
      {
        filePath: "apps/desktop/src/main/forbidden.ts",
        importerKind: "main",
        line: 2,
        rule: "main-no-react",
        specifier: "react-dom",
      },
      {
        filePath: "apps/desktop/src/main/forbidden.ts",
        importerKind: "main",
        line: 3,
        rule: "main-no-zustand",
        specifier: "zustand/vanilla",
      },
      {
        filePath: "apps/desktop/src/main/forbidden.ts",
        importerKind: "main",
        line: 4,
        rule: "main-no-renderer",
        specifier: "@/app",
      },
      {
        filePath: "apps/desktop/src/main/forbidden.ts",
        importerKind: "main",
        line: 5,
        rule: "main-no-renderer",
        specifier:
          "../renderer/src/features/workspace/components/workspace-shell",
      },
    ]);
  });

  it("reports forbidden shared imports including bare node builtins", () => {
    const rootDir = createFixtureRoot();

    writeFixtureFile(
      rootDir,
      "packages/shared/src/forbidden.ts",
      [
        'import { app } from "electron";',
        'import path from "node:path";',
        'import fs from "fs";',
      ].join("\n"),
    );

    expect(checkImportBoundaries({ rootDir })).toEqual([
      {
        filePath: "packages/shared/src/forbidden.ts",
        importerKind: "shared",
        line: 1,
        rule: "shared-no-electron",
        specifier: "electron",
      },
      {
        filePath: "packages/shared/src/forbidden.ts",
        importerKind: "shared",
        line: 2,
        rule: "shared-no-node",
        specifier: "node:path",
      },
      {
        filePath: "packages/shared/src/forbidden.ts",
        importerKind: "shared",
        line: 3,
        rule: "shared-no-node",
        specifier: "fs",
      },
    ]);
  });

  it("ignores allowed imports plus spec files", () => {
    const rootDir = createFixtureRoot();

    writeFixtureFile(
      rootDir,
      "apps/desktop/src/renderer/src/allowed.tsx",
      [
        'import * as React from "react";',
        'import { redactString } from "@pi-desktop/shared";',
      ].join("\n"),
    );
    writeFixtureFile(
      rootDir,
      "apps/desktop/src/main/allowed.ts",
      [
        'import { Effect } from "effect";',
        'import { IPC_CHANNELS } from "@pi-desktop/shared";',
      ].join("\n"),
    );
    writeFixtureFile(
      rootDir,
      "packages/shared/src/allowed.ts",
      'import { Effect } from "effect";\n',
    );
    writeFixtureFile(
      rootDir,
      "apps/desktop/src/main/ignored.spec.ts",
      'import * as React from "react";\n',
    );

    expect(checkImportBoundaries({ rootDir })).toEqual([]);
  });
});
