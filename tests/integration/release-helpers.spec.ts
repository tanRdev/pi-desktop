import { describe, expect, it } from "vitest";

import {
  compareReleaseTags,
  githubReleaseEditArgs,
  isDeveloperIdSignature,
  isUsableDeveloperIdSignature,
  shouldMarkReleaseLatest,
  withBuildHeap,
} from "../../scripts/release-helpers.mjs";

describe("release helpers", () => {
  it("preserves an existing heap cap and otherwise sets 8GB", () => {
    expect(
      withBuildHeap({ NODE_OPTIONS: "--max-old-space-size=4096" }).NODE_OPTIONS,
    ).toBe("--max-old-space-size=4096");
    expect(withBuildHeap({}).NODE_OPTIONS).toBe("--max-old-space-size=8192");
  });

  it("detects Developer ID signatures and rejects adhoc builds", () => {
    expect(
      isDeveloperIdSignature(
        "Authority=Developer ID Application: Example (TEAMID)\nTeamIdentifier=TEAMID\n",
      ),
    ).toBe(true);
    expect(
      isDeveloperIdSignature("Signature=adhoc\nTeamIdentifier=not set\n"),
    ).toBe(false);
  });

  it("treats a failed codesign -dv as unsigned instead of a hard failure", () => {
    const developerId =
      "Authority=Developer ID Application: Example (TEAMID)\nTeamIdentifier=TEAMID\n";
    expect(isUsableDeveloperIdSignature(0, developerId)).toBe(true);
    expect(isUsableDeveloperIdSignature(1, developerId)).toBe(false);
    expect(isUsableDeveloperIdSignature(1, "")).toBe(false);
    expect(
      isUsableDeveloperIdSignature(0, "code object is not signed at all"),
    ).toBe(false);
  });

  it("only marks a release latest when its tag is newest", () => {
    expect(compareReleaseTags("v0.9.5", "v0.9.3")).toBeGreaterThan(0);
    expect(shouldMarkReleaseLatest("v0.9.5", ["v0.9.3", "v0.9.5"])).toBe(true);
    expect(shouldMarkReleaseLatest("v0.9.3", ["v0.9.5"])).toBe(false);
  });

  it("ranks a release above a matching prerelease", () => {
    expect(compareReleaseTags("v1.0.0", "v1.0.0-beta.1")).toBeGreaterThan(0);
    expect(shouldMarkReleaseLatest("v1.0.0-beta.1", ["v1.0.0"])).toBe(false);
  });

  it("never marks a prerelease latest and compares stables only to stables", () => {
    expect(shouldMarkReleaseLatest("v1.0.0-beta.1", [])).toBe(false);
    expect(shouldMarkReleaseLatest("v1.0.0-beta.1", ["v0.9.5"])).toBe(false);
    expect(shouldMarkReleaseLatest("v0.9.5", ["v1.0.0-beta.1"])).toBe(true);
    expect(shouldMarkReleaseLatest("v0.9.5", ["v0.9.3", "v1.0.0-beta.1"])).toBe(
      true,
    );
    expect(shouldMarkReleaseLatest("not-a-tag", ["v0.9.5"])).toBe(false);
  });

  it("explicitly sets --latest=false so draft publish cannot steal latest", () => {
    expect(githubReleaseEditArgs("v0.9.5", ["v0.9.3"])).toEqual([
      "release",
      "edit",
      "v0.9.5",
      "--draft=false",
      "--latest=true",
    ]);
    expect(githubReleaseEditArgs("v0.9.3", ["v0.9.5"])).toEqual([
      "release",
      "edit",
      "v0.9.3",
      "--draft=false",
      "--latest=false",
    ]);
    expect(githubReleaseEditArgs("v1.0.0-beta.1", [])).toEqual([
      "release",
      "edit",
      "v1.0.0-beta.1",
      "--draft=false",
      "--latest=false",
    ]);
    expect(githubReleaseEditArgs("v0.9.5", ["v1.0.0-beta.1"])).toEqual([
      "release",
      "edit",
      "v0.9.5",
      "--draft=false",
      "--latest=true",
    ]);
  });
});
