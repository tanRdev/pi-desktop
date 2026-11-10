import * as React from "react";
import type { WorkspaceGitController } from "./use-workspace-git";

/**
 * Bridge between the command palette's Git commands and the workspace Git
 * controller.
 *
 * The palette stays decoupled from git state: `git-commands.ts` dispatches
 * `pi:git:*` window events. This module is the receiving end — it maps each
 * event to the matching {@link WorkspaceGitController} method so palette
 * actions actually stage, unstage, commit, pull, and push instead of
 * dispatching into the void.
 *
 * - `stage-all` stages every path in the status' unstaged changes (the same
 *   set the Git panel's "stage all" button uses).
 * - `unstage-all` unstages every path in the staged changes.
 * - `focus-commit` commits with the current composer message when one is
 *   present (the controller itself no-ops without a message, mirroring the
 *   panel's disabled Commit button); with an empty message it asks the host
 *   to surface the commit composer instead.
 * - `show-diff` has no controller method — diffs are rendered by the Git
 *   panel — so it asks the host to surface the Git panel.
 */

export type GitPaletteAction =
  | "stage-all"
  | "unstage-all"
  | "focus-commit"
  | "pull"
  | "push"
  | "show-diff";

export interface GitPaletteSurfaceHandlers {
  /** Bring the Git panel (commit composer / diff viewer) to the front. */
  onShowGitSurface?: () => void;
}

export interface GitPaletteBinding {
  controller: WorkspaceGitController;
  surface?: GitPaletteSurfaceHandlers;
}

const ACTION_EVENTS: ReadonlyArray<readonly [string, GitPaletteAction]> = [
  ["pi:git:stage-all", "stage-all"],
  ["pi:git:unstage-all", "unstage-all"],
  ["pi:git:focus-commit", "focus-commit"],
  ["pi:git:pull", "pull"],
  ["pi:git:push", "push"],
  ["pi:git:show-diff", "show-diff"],
];

export async function runGitPaletteAction(
  action: GitPaletteAction,
  binding: GitPaletteBinding,
): Promise<void> {
  const { controller, surface } = binding;
  switch (action) {
    case "stage-all": {
      const paths =
        controller.activeGitRepositoryStatus?.unstagedChanges.map(
          (change) => change.path,
        ) ?? [];
      await controller.stageAllGitFiles(paths);
      return;
    }
    case "unstage-all": {
      const paths =
        controller.activeGitRepositoryStatus?.stagedChanges.map(
          (change) => change.path,
        ) ?? [];
      await controller.unstageAllGitFiles(paths);
      return;
    }
    case "focus-commit": {
      if (controller.gitCommitMessage.trim().length > 0) {
        await controller.commitGitChanges();
      } else {
        surface?.onShowGitSurface?.();
      }
      return;
    }
    case "pull": {
      await controller.pullGitChanges();
      return;
    }
    case "push": {
      await controller.pushGitChanges();
      return;
    }
    case "show-diff": {
      surface?.onShowGitSurface?.();
      return;
    }
  }
}

/**
 * Subscribe to the palette's `pi:git:*` events on `target` and dispatch them
 * to the binding resolved at event time (so status/message changes are
 * always current). Returns an unsubscribe function.
 */
export function bindGitPaletteActions(
  resolveBinding: () => GitPaletteBinding,
  target: Window = window,
): () => void {
  const registrations = ACTION_EVENTS.map(([eventName, action]) => {
    const listener = () => {
      void runGitPaletteAction(action, resolveBinding());
    };
    target.addEventListener(eventName, listener);
    return { eventName, listener };
  });

  return () => {
    for (const { eventName, listener } of registrations) {
      target.removeEventListener(eventName, listener);
    }
  };
}

/** React binding for {@link bindGitPaletteActions}; binds once on mount. */
export function useGitPaletteActions(
  controller: WorkspaceGitController,
  surface?: GitPaletteSurfaceHandlers,
): void {
  const bindingRef = React.useRef<GitPaletteBinding>({ controller, surface });
  bindingRef.current = { controller, surface };

  React.useEffect(() => bindGitPaletteActions(() => bindingRef.current), []);
}
