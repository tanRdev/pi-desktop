import { afterEach, describe, expect, it } from "vitest";
import { commandRegistry } from "./command-registry";
import { GIT_COMMANDS, installGitCommands } from "./git-commands";

afterEach(() => {
  commandRegistry.clear();
});

describe("git-commands", () => {
  const expectedIds = [
    "git-stage-all",
    "git-unstage-all",
    "git-commit",
    "git-pull",
    "git-push",
    "git-show-diff",
  ] as const;

  it("exposes the documented git commands in the Git group", () => {
    const ids = GIT_COMMANDS.map((c) => c.id);
    for (const id of expectedIds) {
      expect(ids).toContain(id);
    }
    for (const command of GIT_COMMANDS) {
      expect(command.group).toBe("Git");
    }
  });

  it("registers every git command into the global registry", () => {
    const dispose = installGitCommands();
    try {
      for (const id of expectedIds) {
        expect(commandRegistry.get(id)).toBeDefined();
      }
    } finally {
      dispose();
    }
    for (const id of expectedIds) {
      expect(commandRegistry.get(id)).toBeUndefined();
    }
  });

  it("is idempotent — second install is a no-op", () => {
    const first = installGitCommands();
    const second = installGitCommands();
    expect(commandRegistry.list()).toHaveLength(GIT_COMMANDS.length);
    second();
    expect(commandRegistry.list()).toHaveLength(GIT_COMMANDS.length);
    first();
    expect(commandRegistry.list()).toHaveLength(0);
  });

  it("invokes run without throwing", () => {
    const dispose = installGitCommands();
    try {
      const cmd = commandRegistry.get("git-stage-all");
      expect(cmd).toBeDefined();
      expect(() =>
        cmd?.run({
          modifier: false,
          close: () => undefined,
          keepOpen: () => undefined,
        }),
      ).not.toThrow();
    } finally {
      dispose();
    }
  });
});
