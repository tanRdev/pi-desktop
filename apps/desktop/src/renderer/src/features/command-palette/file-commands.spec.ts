import { afterEach, describe, expect, it } from "vitest";
import { commandRegistry } from "./command-registry";
import { FILE_COMMANDS, installFileCommands } from "./file-commands";

afterEach(() => {
  commandRegistry.clear();
});

describe("file-commands", () => {
  const expectedIds = ["file-new", "file-rename", "file-reveal"] as const;

  it("exposes the documented file commands in the File group", () => {
    const ids = FILE_COMMANDS.map((c) => c.id);
    for (const id of expectedIds) {
      expect(ids).toContain(id);
    }
    for (const command of FILE_COMMANDS) {
      expect(command.group).toBe("File");
    }
  });

  it("registers every file command into the global registry", () => {
    const dispose = installFileCommands();
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
    const first = installFileCommands();
    const second = installFileCommands();
    expect(commandRegistry.list()).toHaveLength(FILE_COMMANDS.length);
    second();
    expect(commandRegistry.list()).toHaveLength(FILE_COMMANDS.length);
    first();
    expect(commandRegistry.list()).toHaveLength(0);
  });

  it("invokes run without throwing", () => {
    const dispose = installFileCommands();
    try {
      const cmd = commandRegistry.get("file-new");
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
