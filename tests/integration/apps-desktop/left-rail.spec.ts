import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { moveRepositorySnapshots } from "../../../packages/shared/src/models/repository";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function createRepository(id: string) {
  return {
    id,
    name: id,
    rootPath: `/tmp/${id}`,
    defaultBranch: "main",
    worktrees: [],
  };
}

describe("moveRepositorySnapshots", () => {
  it("moves a dragged repository before the drop target", () => {
    const repositories = [
      createRepository("alpha"),
      createRepository("beta"),
      createRepository("gamma"),
    ];

    expect(
      moveRepositorySnapshots(repositories, "gamma", "alpha").map(
        (repository) => repository.id,
      ),
    ).toEqual(["gamma", "alpha", "beta"]);
  });

  it("returns the original order when the drag does not change position", () => {
    const repositories = [
      createRepository("alpha"),
      createRepository("beta"),
      createRepository("gamma"),
    ];

    expect(
      moveRepositorySnapshots(repositories, "beta", "beta").map(
        (repository) => repository.id,
      ),
    ).toEqual(["alpha", "beta", "gamma"]);
  });

  it("returns a new ordered list when a drag target changes position", () => {
    const repositories = [
      createRepository("alpha"),
      createRepository("beta"),
      createRepository("gamma"),
    ];

    const nextRepositories = moveRepositorySnapshots(
      repositories,
      "alpha",
      "gamma",
    );

    expect(nextRepositories).not.toBe(repositories);
    expect(nextRepositories.map((repository) => repository.id)).toEqual([
      "beta",
      "gamma",
      "alpha",
    ]);
  });

  it("updates rail order optimistically before the next shell reload", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).toContain(
      "setOrderedRepositories((currentRepositories) => {",
    );
    expect(source).toContain("window.pidesk.repositories.reorder");
  });

  it("drops the separate project/workspace rail modes from the shell", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).not.toContain('mode: "projects" | "workspace"');
    expect(source).not.toContain("onShowProjects");
    expect(source).not.toContain("onEnterWorkspace");
    expect(shellSource).not.toContain("leftRailMode");
  });

  it("keeps workspace navigation views stable instead of toggling back to null", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).not.toContain(
      "const nextView = activeView === view ? null : view;",
    );
  });

  it("keeps the unified rail focused on thread navigation", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(source).toContain("export const SIDEBAR_WIDTH = 240");
    expect(source).toContain("ThreadCategorySection");
    expect(source).toContain("onSelectThread");
    expect(source).not.toContain("NAVIGATION_ITEMS");
    expect(shellSource).toContain("WorkspaceSurfacePanel");
  });

  it("renders compact thread rows with inline creation affordances", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).toContain("ThreadStatusIcon");
    expect(source).toContain("create-thread-button");
    expect(source).toContain("thread-inline-input");
  });

  it("keeps the archive action out of a nested thread button", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).toContain('data-testid="thread-row"');
    expect(source).toContain("const threadRowClassName = cn(");
    expect(source).not.toMatch(
      /thread-archive-button[\s\S]*?<\/button>\s*<\/button>/,
    );
  });

  it("does not render the old empty-state no threads copy in worktree sections", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).not.toContain("No threads");
  });

  it("separates active and archived threads inside the unified rail", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).toContain('label="Sessions"');
    expect(source).toContain('label="Archived"');
    expect(source).toContain("archivedThreads.map");
  });

  it("keeps the shell free of an extra helper column next to the sessions rail", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(shellSource).not.toContain("LeftSidebar");
    expect(shellSource).not.toContain("ml-16");
  });

  it("marks the unified rail as workspace mode for selector stability", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).toContain('data-mode="workspace"');
  });

  it("prevents text selection in the rail while keeping inline rename selectable", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).toContain("select-none flex-col");
    expect(source).toContain("thread-inline-input");
    expect(source).toContain("inlineThreadInputRef.current?.select()");
  });

  it("removes the thread naming modal in favor of inline rail editing", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );
    const appSource = readSource("apps/desktop/src/renderer/src/app.tsx");

    expect(source).toContain("thread-inline-input");
    expect(appSource).not.toContain("Name your new thread");
    expect(appSource).not.toContain("Random Name");
  });
});
