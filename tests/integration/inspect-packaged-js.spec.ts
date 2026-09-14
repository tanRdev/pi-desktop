import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  inspectDirectory,
  inspectJavaScriptGraph,
} from "../../scripts/inspect-packaged-js.mjs";

const tempRoots: string[] = [];

function createFixtureRoot(): string {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "pi-inspect-js-"));
  tempRoots.push(fixtureRoot);
  return fixtureRoot;
}

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("inspectJavaScriptGraph", () => {
  it("accepts a self-contained ESM graph", () => {
    const problems = inspectJavaScriptGraph({
      "index.js": Buffer.from(
        'import { ot } from "./chunks/lib.js";\nexport { ot };\n',
      ),
      "chunks/lib.js": Buffer.from("export const ot = 1;\n"),
    });

    expect(problems).toEqual([]);
  });

  it("reports the v0.9.3 failure mode: an imported shared chunk that is empty", () => {
    const problems = inspectJavaScriptGraph({
      "out/main/index.js": Buffer.from(
        'import { ot } from "./chunks/lib-WNnjYEnG.js";\n',
      ),
      "out/main/chunks/lib-WNnjYEnG.js": Buffer.from(""),
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "empty",
          file: "out/main/chunks/lib-WNnjYEnG.js",
        }),
        expect.objectContaining({
          kind: "empty-import",
          file: "out/main/index.js",
        }),
      ]),
    );
  });

  it("reports a relative import whose target is missing", () => {
    const problems = inspectJavaScriptGraph({
      "index.js": Buffer.from('import { ot } from "./missing.js";\n'),
    });

    expect(problems).toEqual([
      expect.objectContaining({
        kind: "missing-import",
        file: "index.js",
      }),
    ]);
  });
});

describe("inspectDirectory", () => {
  it("walks a directory of bundled files", () => {
    const rootDir = createFixtureRoot();
    mkdirSync(path.join(rootDir, "chunks"));
    writeFileSync(
      path.join(rootDir, "index.js"),
      'import "./chunks/lib.js";\n',
    );
    writeFileSync(path.join(rootDir, "chunks", "lib.js"), "export {};\n");

    expect(inspectDirectory(rootDir)).toEqual([]);
  });
});
