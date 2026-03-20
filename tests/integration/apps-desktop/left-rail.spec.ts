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

  it("starts in project selection mode instead of jumping into workspace nav", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).not.toContain(
      'activeRepositoryId ? "workspace" : "projects"',
    );
  });

  it("keeps workspace navigation views stable instead of toggling back to null", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).not.toContain(
      "const nextView = activeView === view ? null : view;",
    );
  });

  it("uses tighter tracking across the left rail chrome", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).toContain("tracking-[0.08em]");
    expect(source).not.toContain("tracking-[0.1em]");
    expect(source).not.toContain("tracking-[0.24em]");
  });

  it("offsets the expandable sidebar from the fixed left rail", () => {
    const sidebarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-sidebar.tsx",
    );
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(sidebarSource).toMatch(
      /style=\{\{\s*marginLeft:\s*isCollapsed\s*\?\s*0\s*:\s*LEFT_RAIL_WIDTH,\s*width:\s*isCollapsed\s*\?\s*0\s*:\s*width,\s*\}\}/s,
    );
    expect(sidebarSource).not.toContain("width + LEFT_RAIL_WIDTH");
    expect(sidebarSource).not.toContain("flex min-w-0 flex-1 flex-col pl-16");
    expect(shellSource).toContain(
      '(isLeftSidebarCollapsed || leftRailMode === "projects") && "ml-16"',
    );
  });
});
