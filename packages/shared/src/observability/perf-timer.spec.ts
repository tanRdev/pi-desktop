import { describe, expect, it } from "vitest";
import { measureAsync, measureSync, startTimer } from "./perf-timer.js";

describe("startTimer", () => {
  it("returns the provided name and a non-negative duration", () => {
    const t = startTimer("boot");
    const r = t.stop();
    expect(r.name).toBe("boot");
    expect(r.ms).toBeGreaterThanOrEqual(0);
  });

  it("stop() is idempotent-ish (monotonic non-decreasing)", async () => {
    const t = startTimer("x");
    const first = t.stop().ms;
    await new Promise((r) => setTimeout(r, 5));
    const second = t.stop().ms;
    expect(second).toBeGreaterThanOrEqual(first);
  });

  it("measures roughly the expected elapsed time", async () => {
    const t = startTimer("sleep");
    await new Promise((r) => setTimeout(r, 20));
    const { ms } = t.stop();
    expect(ms).toBeGreaterThanOrEqual(15);
    expect(ms).toBeLessThan(500);
  });
});

describe("measureSync", () => {
  it("returns result and timing", () => {
    const { result, timing } = measureSync("sum", () => 1 + 2);
    expect(result).toBe(3);
    expect(timing.name).toBe("sum");
    expect(timing.ms).toBeGreaterThanOrEqual(0);
  });
});

describe("measureAsync", () => {
  it("awaits the promise and returns timing", async () => {
    const { result, timing } = await measureAsync("delay", async () => {
      await new Promise((r) => setTimeout(r, 10));
      return "ok";
    });
    expect(result).toBe("ok");
    expect(timing.name).toBe("delay");
    expect(timing.ms).toBeGreaterThanOrEqual(5);
  });

  it("propagates rejections", async () => {
    await expect(
      measureAsync("fail", async () => {
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");
  });
});
