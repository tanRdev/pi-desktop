import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { terminateChildWithEscalation } from "../../../apps/desktop/src/main/process-lifecycle";

describe("terminateChildWithEscalation", () => {
  it("resolves immediately for a process that has already exited", async () => {
    const child = spawn(process.execPath, ["-e", "process.exit(0)"], {
      stdio: "ignore",
    });
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    const start = Date.now();
    await terminateChildWithEscalation(child, 200);
    expect(Date.now() - start).toBeLessThan(150);
  });

  it("terminates a well-behaved process with SIGTERM", async () => {
    const child = spawn(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000);"],
      { stdio: "ignore" },
    );
    await new Promise<void>((resolve) => child.once("spawn", () => resolve()));
    await terminateChildWithEscalation(child, 500);
    expect(child.signalCode === "SIGTERM" || child.exitCode !== null).toBe(
      true,
    );
  });

  it("escalates to SIGKILL when a process traps SIGTERM", async () => {
    const script = `
      process.on('SIGTERM', () => { /* swallow */ });
      process.stdout.write('ready\\n');
      setInterval(() => {}, 1000);
    `;
    const child = spawn(process.execPath, ["-e", script], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    child.stdout?.resume();
    await new Promise<void>((resolve) => {
      const onData = (chunk: Buffer) => {
        if (chunk.toString().includes("ready")) {
          child.stdout?.off("data", onData);
          resolve();
        }
      };
      child.stdout?.on("data", onData);
    });
    const exitPromise = new Promise<NodeJS.Signals | null>((resolve) => {
      child.once("exit", (_code, signal) => resolve(signal));
    });
    await terminateChildWithEscalation(child, 200);
    const signal = await exitPromise;
    expect(signal).toBe("SIGKILL");
  });
});
