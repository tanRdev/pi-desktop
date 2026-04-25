import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const scriptPath = path.join(repoRoot, "scripts/check-file-sizes.mjs");
const baselinePath = path.join(repoRoot, "scripts/file-size-baseline.json");

describe("check-file-sizes script", () => {
  it("exits 0 on the current repo", () => {
    const result = spawnSync("node", [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("has a baseline file that is valid JSON", () => {
    expect(existsSync(baselinePath)).toBe(true);

    const raw = readFileSync(baselinePath, "utf8");
    const parsed = JSON.parse(raw);

    expect(parsed).toBeTypeOf("object");
    expect(Array.isArray(parsed)).toBe(false);
    expect(parsed).not.toBeNull();
  });

  it("tracks apps/desktop/src/main/index.ts as a known violator", () => {
    const raw = readFileSync(baselinePath, "utf8");
    const parsed = JSON.parse(raw);

    expect(parsed).toHaveProperty("apps/desktop/src/main/index.ts");
    expect(typeof parsed["apps/desktop/src/main/index.ts"]).toBe("number");
    expect(parsed["apps/desktop/src/main/index.ts"]).toBeGreaterThan(80);
  });

  it("baseline has at least one entry", () => {
    const raw = readFileSync(baselinePath, "utf8");
    const parsed = JSON.parse(raw);

    expect(Object.keys(parsed).length).toBeGreaterThan(0);
  });
});
