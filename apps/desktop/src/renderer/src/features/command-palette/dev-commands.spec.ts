import { afterEach, describe, expect, it } from "vitest";
import { commandRegistry } from "./command-registry";
import { DEV_COMMANDS, installDevCommands } from "./dev-commands";

afterEach(() => {
  commandRegistry.clear();
});

describe("dev-commands", () => {
  const expectedIds = [
    "toggle-devtools",
    "reload-renderer",
    "copy-user-agent",
    "copy-app-version",
    "show-logs",
    "toggle-perf-overlay",
    "trigger-crash",
  ] as const;

  it("exposes the documented command set in the Developer group", () => {
    const ids = DEV_COMMANDS.map((c) => c.id);
    for (const id of expectedIds) {
      expect(ids).toContain(id);
    }
    for (const command of DEV_COMMANDS) {
      expect(command.group).toBe("Developer");
    }
  });

  it("registers every dev command into the global registry", () => {
    const dispose = installDevCommands();
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
    const first = installDevCommands();
    const second = installDevCommands();
    expect(commandRegistry.list()).toHaveLength(DEV_COMMANDS.length);
    second();
    // Second teardown is a no-op, registry should still hold them.
    expect(commandRegistry.list()).toHaveLength(DEV_COMMANDS.length);
    first();
    expect(commandRegistry.list()).toHaveLength(0);
  });

  it("trigger-crash throws so the error boundary can catch it", () => {
    const cmd = DEV_COMMANDS.find((c) => c.id === "trigger-crash");
    expect(cmd).toBeDefined();
    if (cmd === undefined) return;
    expect(() =>
      cmd.run({
        modifier: false,
        close: () => undefined,
        keepOpen: () => undefined,
      }),
    ).toThrow(/trigger-crash/);
  });
});
