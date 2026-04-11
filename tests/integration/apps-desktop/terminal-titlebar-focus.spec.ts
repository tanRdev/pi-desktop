import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("terminal titlebar focus", () => {
  it("clears focus rings from titlebar icon buttons so the active terminal button does not show an outline", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );

    expect(source).toContain("focus:outline-none");
    expect(source).toContain("focus-visible:outline-none");
    expect(source).toContain("focus:ring-0");
    expect(source).toContain("focus-visible:ring-0");
  });
});
