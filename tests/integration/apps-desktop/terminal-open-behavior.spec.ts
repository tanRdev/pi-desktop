import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("terminal open behavior", () => {
  it("opens and reuses a regular shell terminal instead of Pi", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(source).toContain(
      'window.kind === "terminal" && window.backend === "shell"',
    );
    expect(source).toContain('backend: "shell"');
    expect(source).not.toContain('activeThreadId ? "pi" : "shell"');
  });
});
