// @vitest-environment jsdom
import type { GitRepositoryStatus } from "@pi-desktop/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorktree } from "../../../../test/factories";
import {
  bindGitPaletteActions,
  runGitPaletteAction,
} from "./git-palette-bridge";
import type { WorkspaceGitController } from "./use-workspace-git";

function makeController(
  overrides: Partial<WorkspaceGitController> = {},
): WorkspaceGitController {
  const status: GitRepositoryStatus = {
    repositoryPath: "/tmp/repo",
    branch: "main",
    commit: "abc1234",
    upstreamBranch: "origin/main",
    summary: createWorktree().git,
    stagedChanges: [
      {
        path: "staged.ts",
        status: "modified",
        indexStatus: "modified",
        worktreeStatus: null,
      },
    ],
    unstagedChanges: [
      {
        path: "dirty.ts",
        status: "modified",
        indexStatus: null,
        worktreeStatus: "modified",
      },
      {
        path: "new.ts",
        status: "untracked",
        indexStatus: null,
        worktreeStatus: "untracked",
      },
    ],
    conflictedChanges: [],
  };

  return {
    activeGitRepositoryStatus: status,
    gitCommitMessage: "",
    setGitCommitMessage: vi.fn(),
    refreshGitRepositoryStatus: vi.fn(async () => undefined),
    stageGitFile: vi.fn(async () => undefined),
    stageAllGitFiles: vi.fn(async () => undefined),
    unstageGitFile: vi.fn(async () => undefined),
    unstageAllGitFiles: vi.fn(async () => undefined),
    discardGitFile: vi.fn(async () => undefined),
    commitGitChanges: vi.fn(async () => undefined),
    commitAndPushGitChanges: vi.fn(async () => undefined),
    pullGitChanges: vi.fn(async () => undefined),
    pushGitChanges: vi.fn(async () => undefined),
    fetchGitChanges: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("runGitPaletteAction", () => {
  it("stage-all stages every unstaged path from the controller status", async () => {
    const controller = makeController();
    await runGitPaletteAction("stage-all", { controller });
    expect(controller.stageAllGitFiles).toHaveBeenCalledWith([
      "dirty.ts",
      "new.ts",
    ]);
  });

  it("unstage-all unstages every staged path from the controller status", async () => {
    const controller = makeController();
    await runGitPaletteAction("unstage-all", { controller });
    expect(controller.unstageAllGitFiles).toHaveBeenCalledWith(["staged.ts"]);
  });

  it("focus-commit commits when a commit message is present", async () => {
    const controller = makeController({ gitCommitMessage: "feat: thing" });
    const onShowGitSurface = vi.fn();
    await runGitPaletteAction("focus-commit", {
      controller,
      surface: { onShowGitSurface },
    });
    expect(controller.commitGitChanges).toHaveBeenCalledTimes(1);
    expect(onShowGitSurface).not.toHaveBeenCalled();
  });

  it("focus-commit surfaces the composer when the message is empty", async () => {
    const controller = makeController({ gitCommitMessage: "  " });
    const onShowGitSurface = vi.fn();
    await runGitPaletteAction("focus-commit", {
      controller,
      surface: { onShowGitSurface },
    });
    expect(controller.commitGitChanges).not.toHaveBeenCalled();
    expect(onShowGitSurface).toHaveBeenCalledTimes(1);
  });

  it("pull and push call the controller", async () => {
    const controller = makeController();
    await runGitPaletteAction("pull", { controller });
    await runGitPaletteAction("push", { controller });
    expect(controller.pullGitChanges).toHaveBeenCalledTimes(1);
    expect(controller.pushGitChanges).toHaveBeenCalledTimes(1);
  });

  it("show-diff surfaces the Git panel", async () => {
    const controller = makeController();
    const onShowGitSurface = vi.fn();
    await runGitPaletteAction("show-diff", {
      controller,
      surface: { onShowGitSurface },
    });
    expect(onShowGitSurface).toHaveBeenCalledTimes(1);
  });

  it("stage-all is a no-op when there is no repository status", async () => {
    const controller = makeController({ activeGitRepositoryStatus: null });
    await runGitPaletteAction("stage-all", { controller });
    expect(controller.stageAllGitFiles).toHaveBeenCalledWith([]);
  });
});

describe("bindGitPaletteActions", () => {
  let unbind: (() => void) | undefined;

  afterEach(() => {
    unbind?.();
    unbind = undefined;
  });

  it("dispatches pi:git:* window events to the current controller", async () => {
    const controller = makeController();
    unbind = bindGitPaletteActions(() => ({ controller }));

    window.dispatchEvent(new CustomEvent("pi:git:pull"));
    window.dispatchEvent(new CustomEvent("pi:git:stage-all"));

    await vi.waitFor(() => {
      expect(controller.pullGitChanges).toHaveBeenCalledTimes(1);
      expect(controller.stageAllGitFiles).toHaveBeenCalledWith([
        "dirty.ts",
        "new.ts",
      ]);
    });
  });

  it("stops dispatching after unbind", async () => {
    const controller = makeController();
    unbind = bindGitPaletteActions(() => ({ controller }));
    unbind();
    unbind = undefined;

    window.dispatchEvent(new CustomEvent("pi:git:push"));
    await Promise.resolve();

    expect(controller.pushGitChanges).not.toHaveBeenCalled();
  });
});
