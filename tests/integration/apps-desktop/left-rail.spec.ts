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

  it("renders compact thread rows without inline renaming affordances", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).toContain("ThreadStatusIcon");
    expect(source).toContain("create-thread-button");
    expect(source).not.toContain("thread-inline-input");
    expect(source).not.toContain("onRenameThread");
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

  it("prevents text selection in the rail without inline rename logic", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).toContain("select-none flex-col");
    expect(source).not.toContain("thread-inline-input");
    expect(source).not.toContain("inlineThreadInputRef.current?.select()");
  });

  it("removes thread custom naming instead of replacing it with inline editing", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );
    const appSource = readSource("apps/desktop/src/renderer/src/app.tsx");
    const listItemSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/thread-list-item.tsx",
    );

    expect(source).not.toContain("thread-inline-input");
    expect(appSource).not.toContain("Name your new thread");
    expect(appSource).not.toContain("Random Name");
    expect(listItemSource).not.toContain("thread-rename-button");
    expect(listItemSource).not.toContain("thread-rename-input");
    expect(listItemSource).not.toContain("Rename thread");
  });

  it("removes the rename thread API from shared contracts", () => {
    const apiSource = readSource("packages/shared/src/models/api.ts");
    const channelsSource = readSource("packages/shared/src/ipc/channels.ts");

    expect(apiSource).not.toContain("rename(threadId: string, title: string)");
    expect(channelsSource).not.toContain('rename: "threads:rename"');
  });

  it("shows permanent delete confirmation only for archived threads", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );
    const activeSection = source.slice(
      source.indexOf("activeThreads.map((thread) => {"),
      source.indexOf("archivedThreads.map((thread) => {"),
    );
    const archivedSection = source.slice(
      source.indexOf("archivedThreads.map((thread) => {"),
      source.indexOf(
        "</ThreadCategorySection>",
        source.indexOf("archivedThreads.map((thread) => {"),
      ),
    );

    expect(activeSection).not.toContain("archived-thread-delete-button");
    expect(archivedSection).toContain("archived-thread-delete-button");
    expect(archivedSection).toContain(
      "Permanently delete this archived thread?",
    );
    expect(archivedSection).toContain("<PopoverTrigger asChild>");
    expect(archivedSection).toContain(
      "setPendingDeleteThreadId(open ? thread.id : null)",
    );
    expect(archivedSection).toContain("setPendingDeleteThreadId(null);");
    expect(archivedSection).toContain("handleDeleteArchivedThread(thread.id)");
  });

  it("tracks archived delete state locally so confirm menus can reopen after async deletes", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).toContain("pendingDeleteThreadIds");
    expect(source).toContain("new Set(current)");
    expect(source).toContain("next.delete(threadId);");
    expect(source).toContain("next.add(threadId);");
    expect(source).toContain(
      "const isDeletingThread = pendingDeleteThreadIds.has(thread.id)",
    );
  });

  it("keeps archived delete confirmation buttons responsive while delete is pending", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).toContain("disabled={isDeletingThread}");
    expect(source).toContain("void handleDeleteArchivedThread(thread.id);");
    expect(source).toContain('{isDeletingThread ? "Deleting..." : "Delete"}');
  });

  it("keeps left-rail top actions from rendering tooltips into the title-bar chrome", () => {
    const source = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(source).toContain(
      '<TooltipContent side="right">{actionLabel}</TooltipContent>',
    );
    expect(source).toContain(
      '<TooltipContent side="right">New workspace</TooltipContent>',
    );
    expect(source).not.toContain(
      '<TooltipContent side="top">{actionLabel}</TooltipContent>',
    );
  });
});
