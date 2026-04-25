import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempRoots: string[] = [];
const repoRoot = process.cwd();

function createFixtureRoot(): string {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "pi-desktop-perf-"));
  tempRoots.push(rootDir);
  return rootDir;
}

function writeFixtureFile(
  rootDir: string,
  relativePath: string,
  sizeInBytes: number,
): void {
  const filePath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.alloc(sizeInBytes, "x"), "utf8");
}

function runPerfScript(
  scriptName: string,
  rootDir: string,
  env: NodeJS.ProcessEnv,
): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const scriptPath = path.join(repoRoot, "scripts", scriptName);
  const result = spawnSync(process.execPath, [scriptPath, rootDir], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("perf budget scripts", () => {
  it("passes bundle budgets when built output directories stay within limits", () => {
    const rootDir = createFixtureRoot();

    writeFixtureFile(rootDir, "apps/desktop/out/main/index.js", 40);
    writeFixtureFile(rootDir, "apps/desktop/out/preload/index.cjs", 30);
    writeFixtureFile(rootDir, "apps/desktop/out/renderer/index.html", 20);
    writeFixtureFile(rootDir, "apps/desktop/out/renderer/assets/app.js", 50);

    const result = runPerfScript("perf-bundle.mjs", rootDir, {
      PI_PERF_BUNDLE_MAIN_MAX_BYTES: "64",
      PI_PERF_BUNDLE_PRELOAD_MAX_BYTES: "64",
      PI_PERF_BUNDLE_RENDERER_MAX_BYTES: "96",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Bundle budget check passed");
    expect(result.stdout).toContain("main: 40 B / 64 B");
    expect(result.stdout).toContain("preload: 30 B / 64 B");
    expect(result.stdout).toContain("renderer: 70 B / 96 B");
  });

  it("fails bundle budgets when a built output directory exceeds its threshold", () => {
    const rootDir = createFixtureRoot();

    writeFixtureFile(rootDir, "apps/desktop/out/main/index.js", 40);
    writeFixtureFile(rootDir, "apps/desktop/out/preload/index.cjs", 30);
    writeFixtureFile(rootDir, "apps/desktop/out/renderer/index.html", 20);
    writeFixtureFile(rootDir, "apps/desktop/out/renderer/assets/app.js", 90);

    const result = runPerfScript("perf-bundle.mjs", rootDir, {
      PI_PERF_BUNDLE_MAIN_MAX_BYTES: "64",
      PI_PERF_BUNDLE_PRELOAD_MAX_BYTES: "64",
      PI_PERF_BUNDLE_RENDERER_MAX_BYTES: "96",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Bundle budget check failed");
    expect(result.stderr).toContain("renderer: 110 B / 96 B");
  });

  it("passes startup budgets when critical entrypoints exist within limits", () => {
    const rootDir = createFixtureRoot();

    writeFixtureFile(rootDir, "apps/desktop/out/main/index.js", 90);
    writeFixtureFile(rootDir, "apps/desktop/out/preload/index.cjs", 70);
    writeFixtureFile(rootDir, "apps/desktop/out/renderer/index.html", 40);

    const result = runPerfScript("perf-startup.mjs", rootDir, {
      PI_PERF_STARTUP_MAIN_MAX_BYTES: "96",
      PI_PERF_STARTUP_PRELOAD_MAX_BYTES: "80",
      PI_PERF_STARTUP_RENDERER_HTML_MAX_BYTES: "64",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Startup budget check passed");
    expect(result.stdout).toContain("main/index.js: 90 B / 96 B");
    expect(result.stdout).toContain("preload/index.cjs: 70 B / 80 B");
    expect(result.stdout).toContain("renderer/index.html: 40 B / 64 B");
  });

  it("fails startup budgets when a critical entrypoint is missing", () => {
    const rootDir = createFixtureRoot();

    writeFixtureFile(rootDir, "apps/desktop/out/main/index.js", 90);
    writeFixtureFile(rootDir, "apps/desktop/out/renderer/index.html", 40);

    const result = runPerfScript("perf-startup.mjs", rootDir, {
      PI_PERF_STARTUP_MAIN_MAX_BYTES: "96",
      PI_PERF_STARTUP_PRELOAD_MAX_BYTES: "80",
      PI_PERF_STARTUP_RENDERER_HTML_MAX_BYTES: "64",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Startup budget check failed");
    expect(result.stderr).toContain(
      "Missing required file: apps/desktop/out/preload/index.cjs",
    );
  });
});
