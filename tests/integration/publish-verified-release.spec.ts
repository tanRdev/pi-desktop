import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  GITHUB_PUBLISHED_RELEASE_TAGS_ARGS,
  parsePublishedReleaseTagLines,
} from "../../scripts/publish-verified-release.mjs";

describe("publish verified release", () => {
  it("paginates GitHub releases instead of capping at 1000", () => {
    expect(GITHUB_PUBLISHED_RELEASE_TAGS_ARGS).toContain("--paginate");
    expect(GITHUB_PUBLISHED_RELEASE_TAGS_ARGS.join(" ")).not.toMatch(
      /--limit\s+1000/,
    );
    expect(GITHUB_PUBLISHED_RELEASE_TAGS_ARGS.join(" ")).toContain(
      "select(.draft == false)",
    );
  });

  it("parses paginated jq tag lines including quoted names", () => {
    expect(parsePublishedReleaseTagLines('"v0.9.5"\nv0.9.3\n\n')).toEqual([
      "v0.9.5",
      "v0.9.3",
    ]);
  });
});

describe("CI packs a real unsigned electron-builder asar", () => {
  it("uses pack:mac:dir instead of packing Vite out/", () => {
    const ci = readFileSync(
      path.resolve(process.cwd(), ".github/workflows/ci.yml"),
      "utf8",
    );
    const desktopPackage = JSON.parse(
      readFileSync(
        path.resolve(process.cwd(), "apps/desktop/package.json"),
        "utf8",
      ),
    );

    expect(ci).toContain("pack:mac:dir");
    expect(ci).toContain("CSC_IDENTITY_AUTO_DISCOVERY");
    expect(ci).not.toContain("--pack-dir");
    expect(ci).toMatch(/timeout-minutes:\s*45/);
    expect(desktopPackage.scripts["pack:mac:dir"]).toContain("--mac dir");
    expect(desktopPackage.scripts["pack:mac:dir"]).toContain(
      "CSC_IDENTITY_AUTO_DISCOVERY=false",
    );
  });
});
