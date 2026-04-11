import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("LeftRail category interactions", () => {
  it("renders always-visible Sessions and Archived sections without tally bars", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    // Must not have hover-based category switching
    expect(source).not.toContain("onMouseMove={onHoverActivate}");
    expect(source).not.toContain("onFocus={onActivate}");
    expect(source).not.toContain("queueHoverCategory");

    // No expand/collapse mechanism
    expect(source).not.toContain("aria-expanded");
    expect(source).not.toContain("expandedSection");

    // Category sections for Sessions and Archived
    expect(source).toContain('label="Sessions"');
    expect(source).toContain('label="Archived"');

    // No tally bar chrome in the section headers
    expect(source).not.toContain("TallyBars");

    // No mock data
    expect(source).not.toContain("MOCK_THREADS");
  });
});
