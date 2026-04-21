import type { Command } from "./command-registry";
import { registerCommand } from "./command-registry";

/**
 * Git commands. These dispatch `pi:git:*` events on `window` so the git
 * surface (sidebar, status panel, commit composer) can react. The palette
 * itself stays decoupled from git state.
 */

const GROUP = "Git";

function dispatchGitEvent(suffix: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`pi:git:${suffix}`, { detail }));
}

export const GIT_COMMANDS: ReadonlyArray<Command> = [
  {
    id: "git-stage-all",
    title: "Git: Stage All Changes",
    group: GROUP,
    keywords: ["git", "stage", "add", "all"],
    run: () => {
      dispatchGitEvent("stage-all");
    },
  },
  {
    id: "git-unstage-all",
    title: "Git: Unstage All",
    group: GROUP,
    keywords: ["git", "unstage", "reset", "all"],
    run: () => {
      dispatchGitEvent("unstage-all");
    },
  },
  {
    id: "git-commit",
    title: "Git: Commit",
    group: GROUP,
    keywords: ["git", "commit", "message"],
    run: () => {
      dispatchGitEvent("focus-commit");
    },
  },
  {
    id: "git-pull",
    title: "Git: Pull",
    group: GROUP,
    keywords: ["git", "pull", "fetch", "sync"],
    run: () => {
      dispatchGitEvent("pull");
    },
  },
  {
    id: "git-push",
    title: "Git: Push",
    group: GROUP,
    keywords: ["git", "push", "upload", "sync"],
    run: () => {
      dispatchGitEvent("push");
    },
  },
  {
    id: "git-show-diff",
    title: "Git: Show Diff for Current File",
    group: GROUP,
    keywords: ["git", "diff", "current", "file", "changes"],
    run: () => {
      dispatchGitEvent("show-diff");
    },
  },
];

let registered = false;
let disposers: Array<() => void> = [];

export function installGitCommands(): () => void {
  if (registered) {
    return () => undefined;
  }
  registered = true;
  disposers = GIT_COMMANDS.map((c) => registerCommand(c));
  return () => {
    for (const dispose of disposers) dispose();
    disposers = [];
    registered = false;
  };
}
