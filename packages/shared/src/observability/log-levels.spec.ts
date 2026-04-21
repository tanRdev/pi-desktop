import { describe, expect, it } from "vitest";
import {
  isLogLevel,
  LOG_LEVELS,
  logLevelRank,
  parseLogLevel,
  shouldLog,
} from "./log-levels.js";

describe("log-levels", () => {
  it("exposes all five levels in ascending order", () => {
    expect(LOG_LEVELS).toEqual(["trace", "debug", "info", "warn", "error"]);
    const ranks = LOG_LEVELS.map(logLevelRank);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
  });

  it("shouldLog respects the configured minimum", () => {
    expect(shouldLog("info", "info")).toBe(true);
    expect(shouldLog("debug", "info")).toBe(false);
    expect(shouldLog("error", "info")).toBe(true);
    expect(shouldLog("trace", "trace")).toBe(true);
    expect(shouldLog("warn", "error")).toBe(false);
  });

  it("isLogLevel type guards correctly", () => {
    expect(isLogLevel("info")).toBe(true);
    expect(isLogLevel("bogus")).toBe(false);
    expect(isLogLevel(42)).toBe(false);
    expect(isLogLevel(null)).toBe(false);
  });

  it("parseLogLevel accepts valid inputs case-insensitively", () => {
    expect(parseLogLevel("WARN")).toBe("warn");
    expect(parseLogLevel("  debug  ")).toBe("debug");
    expect(parseLogLevel("trace")).toBe("trace");
  });

  it("parseLogLevel falls back when invalid", () => {
    expect(parseLogLevel(undefined)).toBe("info");
    expect(parseLogLevel("")).toBe("info");
    expect(parseLogLevel("loud", "error")).toBe("error");
    expect(parseLogLevel(123)).toBe("info");
  });
});
