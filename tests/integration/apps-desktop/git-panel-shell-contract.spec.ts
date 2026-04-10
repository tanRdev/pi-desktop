import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("git panel shell contract", () => {
  it("passes the active worktree and open-git action into the default right sidebar", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(shellSource).toContain("worktree={activeWorktree}");
    expect(shellSource).toContain("onOpenGit={onOpenGit}");
  });
});
