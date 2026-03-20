import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("titlebar chrome", () => {
  it("uses platform-aware traffic-light spacing instead of a single hardcoded inset", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/lib/title-bar-layout.ts",
    );

    expect(source).toContain("platform");
    expect(source).toContain('platform === "darwin"');
    expect(source).toContain("return 16");
  });

  it("keeps the project title isolated on the left and moves selectors plus actions to the right cluster", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );

    expect(source).toContain('data-slot="titlebar-project"');
    expect(source).toContain('data-slot="titlebar-controls"');
    expect(source).not.toContain("grid-cols-[1fr_auto_1fr]");
  });

  it("guards the files action when there is no active worktree to browse", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );

    expect(source).toContain("canOpenFileTree");
    expect(source).toContain("disabled={!canOpenFileTree}");
    expect(source).toContain('? "Browse files"');
    expect(source).toContain(': "Select a worktree to browse files"');
  });

  it("threads shell platform data into the workspace title bar layout", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(shellSource).toContain("platform={platform}");
    expect(shellSource).toContain("platform: string | null");
    expect(controllerSource).toContain(
      "const platform = shell.platform ?? null;",
    );
  });

  it("shows a guided empty state in the files overlay instead of a generic no-workspace message", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-overlays.tsx",
    );

    expect(source).toContain("Select a repository or worktree to browse files");
    expect(source).toContain("Choose a branch on the right");
    expect(source).toContain("max-w-3xl");
  });
});
