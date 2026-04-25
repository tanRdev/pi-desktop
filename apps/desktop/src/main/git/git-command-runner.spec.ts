import { describe, expect, it } from "vitest";
import {
  createExecFileErrorResult,
  createGitCommandErrorResult,
  normalizeGitCommandResult,
} from "./git-command-runner";

describe("git-command-runner", () => {
  it("normalizes child process results into the shared git command shape", () => {
    expect(
      normalizeGitCommandResult({
        status: null,
        stdout: new TextEncoder().encode("ok\n"),
        stderr: undefined,
        error: undefined,
      }),
    ).toEqual({
      status: 1,
      stdout: "ok\n",
      stderr: "",
      error: null,
    });
  });

  it("maps execFile status failures without converting them into thrown errors", () => {
    expect(
      createExecFileErrorResult({
        status: 128,
        stdout: "",
        stderr: "fatal: bad revision",
      }),
    ).toEqual({
      status: 128,
      stdout: "",
      stderr: "fatal: bad revision",
      error: null,
    });
  });

  it("wraps unexpected thrown values as git command errors", () => {
    expect(createGitCommandErrorResult("spawn failed")).toEqual({
      status: 1,
      stdout: "",
      stderr: "",
      error: new Error("spawn failed"),
    });
  });
});
