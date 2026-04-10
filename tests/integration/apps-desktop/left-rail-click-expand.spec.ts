import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("LeftRail category interactions", () => {
  it("keeps expansion on click while using hover only for icon affordance", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).not.toContain("onMouseMove={onHoverActivate}");
    expect(source).not.toContain("onFocus={onActivate}");
    expect(source).not.toContain("queueHoverCategory");
    expect(source).toContain("aria-expanded={isExpanded}");
    expect(source).toContain("group-hover/item:opacity-0");
    expect(source).toContain("group-hover/item:scale-90");
    expect(source).toContain("group-hover/item:opacity-100");
    expect(source).toContain("group-hover/item:scale-100");
    expect(source).toContain("group-hover/item:animate-pulse");
    expect(source).toContain("!isExpanded &&");
    expect(source).toContain(
      "group-hover/item:scale-90 group-hover/item:opacity-0",
    );
    expect(source).toContain("text-white/70");
    expect(source).toContain("{!isExpanded ? (");
  });
});
