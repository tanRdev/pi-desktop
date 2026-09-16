import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  asarEntryPath,
  inspectAsar,
  inspectDirectory,
  inspectJavaScriptGraph,
  isMainProcessJs,
  moduleExportsName,
  moduleHasExport,
  packDirectoryAndInspect,
} from "../../scripts/inspect-packaged-js.mjs";

const require = createRequire(import.meta.url);
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
      "out/main/index.js": Buffer.from(
        'import { ot } from "./chunks/lib.js";\nexport { ot };\n',
      ),
      "out/main/chunks/lib.js": Buffer.from("export const ot = 1;\n"),
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
      "out/main/index.js": Buffer.from('import { ot } from "./missing.js";\n'),
    });

    expect(problems).toEqual([
      expect.objectContaining({
        kind: "missing-import",
        file: "out/main/index.js",
      }),
    ]);
  });

  it("reports a multiline named import whose target does not export that name", () => {
    const problems = inspectJavaScriptGraph({
      "out/main/index.js": Buffer.from(
        'import {\n  ot\n} from "./chunks/lib.js";\n',
      ),
      "out/main/chunks/lib.js": Buffer.from("export const other = 1;\n"),
    });

    expect(problems).toEqual([
      expect.objectContaining({
        kind: "missing-export",
        file: "out/main/index.js",
        detail: "imports ot from ./chunks/lib.js but that export is missing",
      }),
    ]);
  });

  it("follows export * from instead of treating star re-exports as universal", () => {
    const missing = inspectJavaScriptGraph({
      "out/main/index.js": Buffer.from('import { ot } from "./barrel.js";\n'),
      "out/main/barrel.js": Buffer.from('export * from "./lib.js";\n'),
      "out/main/lib.js": Buffer.from("export const other = 1;\n"),
    });
    expect(missing).toEqual([
      expect.objectContaining({
        kind: "missing-export",
        file: "out/main/index.js",
      }),
    ]);

    const present = inspectJavaScriptGraph({
      "out/main/index.js": Buffer.from('import { ot } from "./barrel.js";\n'),
      "out/main/barrel.js": Buffer.from('export * from "./lib.js";\n'),
      "out/main/lib.js": Buffer.from("export const ot = 1;\n"),
    });
    expect(present).toEqual([]);
  });

  it("follows named export { local as exported } from instead of treating it as local", () => {
    const missingLocal = inspectJavaScriptGraph({
      "out/main/index.js": Buffer.from('import { ot } from "./barrel.js";\n'),
      "out/main/barrel.js": Buffer.from(
        'export { missing as ot } from "./lib.js";\n',
      ),
      "out/main/lib.js": Buffer.from("export const other = 1;\n"),
    });
    expect(missingLocal).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "missing-export",
          file: "out/main/index.js",
        }),
      ]),
    );

    const missingExported = inspectJavaScriptGraph({
      "out/main/index.js": Buffer.from('import { ot } from "./barrel.js";\n'),
      "out/main/barrel.js": Buffer.from('export { ot } from "./lib.js";\n'),
      "out/main/lib.js": Buffer.from("export const other = 1;\n"),
    });
    expect(missingExported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "missing-export",
          file: "out/main/index.js",
        }),
      ]),
    );

    const present = inspectJavaScriptGraph({
      "out/main/index.js": Buffer.from('import { ot } from "./barrel.js";\n'),
      "out/main/barrel.js": Buffer.from(
        'export { source as ot } from "./lib.js";\n',
      ),
      "out/main/lib.js": Buffer.from("export const source = 1;\n"),
    });
    expect(present).toEqual([]);
  });

  it("follows minified export*from and export{ot}from", () => {
    const starPresent = inspectJavaScriptGraph({
      "out/main/index.js": Buffer.from('import { ot } from "./barrel.js";\n'),
      "out/main/barrel.js": Buffer.from('export*from"./lib.js";\n'),
      "out/main/lib.js": Buffer.from("export const ot = 1;\n"),
    });
    expect(starPresent).toEqual([]);

    const namedPresent = inspectJavaScriptGraph({
      "out/main/index.js": Buffer.from('import { ot } from "./barrel.js";\n'),
      "out/main/barrel.js": Buffer.from('export{ot}from"./lib.js";\n'),
      "out/main/lib.js": Buffer.from("export const ot = 1;\n"),
    });
    expect(namedPresent).toEqual([]);

    const namedMissing = inspectJavaScriptGraph({
      "out/main/index.js": Buffer.from('import { ot } from "./barrel.js";\n'),
      "out/main/barrel.js": Buffer.from('export{ot}from"./lib.js";\n'),
      "out/main/lib.js": Buffer.from("export const other = 1;\n"),
    });
    expect(namedMissing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "missing-export",
          file: "out/main/index.js",
        }),
      ]),
    );
  });

  it("does not require named exports from renderer bundles", () => {
    const problems = inspectJavaScriptGraph({
      "out/renderer/index.js": Buffer.from(
        'import { ot } from "./chunk.js";\n',
      ),
      "out/renderer/chunk.js": Buffer.from("export const other = 1;\n"),
    });
    expect(problems).toEqual([]);
  });

  it("still reports empty renderer files", () => {
    const problems = inspectJavaScriptGraph({
      "out/renderer/index.js": Buffer.from('import "./chunk.js";\n'),
      "out/renderer/chunk.js": Buffer.from(""),
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "empty",
          file: "out/renderer/chunk.js",
        }),
      ]),
    );
  });

  it("ignores node_modules JavaScript", () => {
    const problems = inspectJavaScriptGraph({
      "out/main/index.js": Buffer.from("export const main = 1;\n"),
      "node_modules/node-pty/lib/index.js": Buffer.from(""),
    });
    expect(problems).toEqual([]);
  });
});

describe("isMainProcessJs", () => {
  it("matches packaged and Vite main-process paths", () => {
    expect(isMainProcessJs("out/main/index.js")).toBe(true);
    expect(isMainProcessJs("main/index.js")).toBe(true);
    expect(isMainProcessJs("out/renderer/index.js")).toBe(false);
    expect(isMainProcessJs("out/preload/index.js")).toBe(false);
  });
});

describe("moduleExportsName", () => {
  it("accepts renamed and minified export forms", () => {
    expect(moduleExportsName("export { foo as ot };\n", "ot")).toBe(true);
    expect(moduleExportsName("export{ot};\n", "ot")).toBe(true);
    expect(moduleExportsName("export const other = 1;\n", "ot")).toBe(false);
  });

  it("does not treat the local name of `export { ot as n }` as exported", () => {
    expect(moduleExportsName("export { ot as n };\n", "ot")).toBe(false);
    expect(moduleExportsName("export { ot as n };\n", "n")).toBe(true);
  });

  it("does not treat export * from as exporting every name", () => {
    expect(moduleExportsName('export * from "./lib.js";\n', "ot")).toBe(false);
  });

  it("does not treat named re-exports as local exports", () => {
    expect(moduleExportsName('export { ot } from "./lib.js";\n', "ot")).toBe(
      false,
    );
    expect(moduleExportsName('export{ot}from"./lib.js";\n', "ot")).toBe(false);
    expect(moduleExportsName("export { ot };\n", "ot")).toBe(true);
  });
});

describe("moduleHasExport", () => {
  it("walks aliased named re-exports to the local name", () => {
    const files = {
      "out/main/barrel.js": Buffer.from(
        'export { source as ot } from "./lib.js";\n',
      ),
      "out/main/lib.js": Buffer.from("export const source = 1;\n"),
    };
    expect(moduleHasExport(files, "out/main/barrel.js", "ot")).toBe(true);
    expect(moduleHasExport(files, "out/main/barrel.js", "source")).toBe(false);
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

  it("fails closed when the directory has no JavaScript", () => {
    const rootDir = createFixtureRoot();
    writeFileSync(path.join(rootDir, "readme.txt"), "no js\n");

    expect(() => inspectDirectory(rootDir)).toThrow(/No JavaScript files/);
  });

  it("does not walk node_modules", () => {
    const rootDir = createFixtureRoot();
    mkdirSync(path.join(rootDir, "out/main"), { recursive: true });
    mkdirSync(path.join(rootDir, "node_modules/node-pty"), { recursive: true });
    writeFileSync(
      path.join(rootDir, "out/main/index.js"),
      "export const n = 1;\n",
    );
    writeFileSync(path.join(rootDir, "node_modules/node-pty/index.js"), "");

    expect(inspectDirectory(rootDir)).toEqual([]);
  });
});

describe("inspectAsar", () => {
  it("strips leading slashes from listed asar paths", () => {
    expect(asarEntryPath("/out/main/index.js")).toBe("out/main/index.js");
    expect(asarEntryPath("out/main/index.js")).toBe("out/main/index.js");
  });

  it("reads packed files and reports an empty imported chunk", async () => {
    const asar = require("@electron/asar");
    const rootDir = createFixtureRoot();
    const appDir = path.join(rootDir, "app");
    const asarPath = path.join(rootDir, "app.asar");
    mkdirSync(path.join(appDir, "out/main/chunks"), { recursive: true });
    writeFileSync(
      path.join(appDir, "out/main/index.js"),
      'import { ot } from "./chunks/lib-WNnjYEnG.js";\n',
    );
    writeFileSync(path.join(appDir, "out/main/chunks/lib-WNnjYEnG.js"), "");

    await asar.createPackage(appDir, asarPath);

    const problems = inspectAsar(asarPath, process.cwd());
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

  it("reads files even when listPackage prefixes paths with a slash", async () => {
    const asar = require("@electron/asar");
    const rootDir = createFixtureRoot();
    const appDir = path.join(rootDir, "app");
    const asarPath = path.join(rootDir, "app.asar");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(path.join(appDir, "index.js"), "export const ot = 1;\n");
    await asar.createPackage(appDir, asarPath);

    const listed = asar.listPackage(asarPath);
    expect(listed.some((entry: string) => entry.startsWith("/"))).toBe(true);

    const problems = inspectAsar(asarPath, process.cwd());
    expect(problems).toEqual([]);
  });

  it("skips node_modules entries in the asar", async () => {
    const asar = require("@electron/asar");
    const rootDir = createFixtureRoot();
    const appDir = path.join(rootDir, "app");
    const asarPath = path.join(rootDir, "app.asar");
    mkdirSync(path.join(appDir, "out/main"), { recursive: true });
    mkdirSync(path.join(appDir, "node_modules/node-pty"), { recursive: true });
    writeFileSync(
      path.join(appDir, "out/main/index.js"),
      "export const main = 1;\n",
    );
    writeFileSync(path.join(appDir, "node_modules/node-pty/index.js"), "");
    await asar.createPackage(appDir, asarPath);

    expect(inspectAsar(asarPath, process.cwd())).toEqual([]);
  });

  it("packs a directory to asar and inspects the archive", async () => {
    const rootDir = createFixtureRoot();
    mkdirSync(path.join(rootDir, "out/main"), { recursive: true });
    writeFileSync(
      path.join(rootDir, "out/main/index.js"),
      'import { ot } from "./lib.js";\nexport { ot };\n',
    );
    writeFileSync(
      path.join(rootDir, "out/main/lib.js"),
      "export const ot = 1;\n",
    );

    await expect(packDirectoryAndInspect(rootDir)).resolves.toEqual([]);
  });
});
