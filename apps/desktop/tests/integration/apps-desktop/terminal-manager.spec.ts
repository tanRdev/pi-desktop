import type { TerminalCreateOptions } from "@pidesk/shared";
import { describe, expect, it, vi } from "vitest";
import { TerminalManager } from "../../../apps/desktop/src/main/terminal-manager";

describe("TerminalManager (injection seam)", () => {
  it("allows injecting child_process and node-pty to avoid ordering/mocking issues", () => {
    // fake spawnSync that reports no tmux present
    const fakeSpawnSync = vi.fn(() => ({ status: 1, stdout: "", stderr: "" }));
    // fake node-pty module
    const fakePty = {
      spawn: vi.fn(() => ({
        onData: vi.fn((cb: any) => undefined),
        onExit: vi.fn((cb: any) => undefined),
        write: vi.fn(),
        kill: vi.fn(),
        resize: vi.fn(),
      })),
    };

    const fakeSpawn = vi.fn(() => ({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn(), destroyed: false },
      on: vi.fn(),
      kill: vi.fn(),
    }));

    const tm = new TerminalManager({
      spawn: fakeSpawn as any,
      spawnSync: fakeSpawnSync as any,
      nodeRequire: (id: string) => {
        if (id === "node-pty") return fakePty;
        throw new Error("unexpected require: " + id);
      },
    });

    // initialize should load the fake node-pty
    tm.initialize();
    expect((tm as any).ptyModule).toBe(fakePty);

    const opts: TerminalCreateOptions = {
      id: "term-1",
      cols: 80,
      rows: 24,
      ownerWindowId: "terminal-term-1",
      backend: "shell",
    };

    const session = tm.create("term-1", opts);
    expect(session.id).toBe("term-1");
    expect(fakePty.spawn).toHaveBeenCalled();
  });
});
