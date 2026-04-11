import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("git panel shell contract", () => {
  it("passes the active worktree and repository path into the default right sidebar", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(shellSource).toContain("worktree={activeWorktree}");
    expect(shellSource).toContain("shellGit={shellGit}");
    expect(shellSource).toContain("repositoryPath={");
    expect(shellSource).toContain("activeWorktree?.path ??");
    expect(shellSource).toContain("activeRepository?.rootPath ??");
    expect(controllerSource).toContain("shellGit: shell.git ?? null");
  });
});
