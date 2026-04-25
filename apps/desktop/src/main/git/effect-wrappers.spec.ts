import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GitError } from "../effect/errors";
import { createGitAsyncEffect, createGitSyncEffect } from "./effect-wrappers";

function expectFailureError(exit: unknown): asserts exit is {
  _tag: "Failure";
  cause: { _tag: "Fail"; error: GitError };
} {
  expect(exit).toMatchObject({
    _tag: "Failure",
    cause: { _tag: "Fail" },
  });
}

describe("effect-wrappers", () => {
  it("wraps synchronous git operations in an Effect", async () => {
    const effect = createGitSyncEffect({
      try: () => "ready",
      catch: (cause) =>
        new GitError({
          code: "EGIT_FAILED",
          message: "unexpected",
          cause,
        }),
    });

    await expect(Effect.runPromise(effect)).resolves.toBe("ready");
  });

  it("maps synchronous failures into GitError", async () => {
    const failure = new Error("sync failed");
    const effect = createGitSyncEffect({
      try: () => {
        throw failure;
      },
      catch: (cause) =>
        new GitError({
          code: "EGIT_FAILED",
          message: "Failed to inspect repository at /repo",
          path: "/repo",
          cause,
        }),
    });

    const exit = await Effect.runPromiseExit(effect);
    expectFailureError(exit);
    expect(exit.cause.error).toMatchObject({
      code: "EGIT_FAILED",
      message: "Failed to inspect repository at /repo",
      path: "/repo",
      cause: failure,
    });
  });

  it("maps async failures into GitError", async () => {
    const failure = new Error("async failed");
    const effect = createGitAsyncEffect({
      try: async () => {
        throw failure;
      },
      catch: (cause) =>
        new GitError({
          code: "EGIT_FAILED",
          message: "Failed to fetch at /repo",
          path: "/repo",
          cause,
        }),
    });

    const exit = await Effect.runPromiseExit(effect);
    expectFailureError(exit);
    expect(exit.cause.error).toMatchObject({
      code: "EGIT_FAILED",
      message: "Failed to fetch at /repo",
      path: "/repo",
      cause: failure,
    });
  });
});
