import { describe, expect, it } from "vitest";

import {
  compareReleaseTags,
  isDeveloperIdSignature,
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

  it("only marks a release latest when its tag is newest", () => {
    expect(compareReleaseTags("v0.9.5", "v0.9.3")).toBeGreaterThan(0);
    expect(shouldMarkReleaseLatest("v0.9.5", ["v0.9.3", "v0.9.5"])).toBe(true);
    expect(shouldMarkReleaseLatest("v0.9.3", ["v0.9.5"])).toBe(false);
  });
});
