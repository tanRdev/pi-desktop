import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Workspace shell sidebar affordances", () => {
  it("reopens the left rail from the app edge and keeps packages in the header", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const railSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(shellSource).toContain(
      "onMouseEnter={() => setIsLeftRailVisible(true)}",
    );
    expect(shellSource).not.toContain(
      "onClick={() => setIsLeftRailVisible(true)}",
    );
    expect(shellSource).toContain("onClick={onOpenMarketplace}");
    expect(shellSource).toContain("SquaresFour");
    expect(railSource).not.toContain("<span>Packages</span>");
  });
});
