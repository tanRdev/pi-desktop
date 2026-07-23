import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  repositoryContracts,
  threadContracts,
  worktreeContracts,
} from "./index.js";

describe("repositoryContracts request schemas", () => {
  it("accepts valid repository add payloads", () => {
    const decode = Schema.decodeUnknownSync(repositoryContracts.add.request);
    expect(decode({ path: "/tmp/repo" })).toEqual({ path: "/tmp/repo" });
  });

  it("rejects repository add payloads with missing or invalid path", () => {
    const decode = Schema.decodeUnknownSync(repositoryContracts.add.request);
    expect(() => decode({})).toThrow();
    expect(() => decode({ path: 42 })).toThrow();
  });

  it("accepts valid repository select payloads", () => {
    const decode = Schema.decodeUnknownSync(repositoryContracts.select.request);
    expect(decode({ repositoryId: "repo-1" })).toEqual({
      repositoryId: "repo-1",
    });
  });

  it("rejects repository select payloads with missing or invalid repositoryId", () => {
    const decode = Schema.decodeUnknownSync(repositoryContracts.select.request);
    expect(() => decode({})).toThrow();
    expect(() => decode({ repositoryId: false })).toThrow();
  });

  it("accepts valid repository reorder payloads", () => {
    const decode = Schema.decodeUnknownSync(
      repositoryContracts.reorder.request,
    );
    expect(decode({ repositoryIds: ["a", "b"] })).toEqual({
      repositoryIds: ["a", "b"],
    });
  });

  it("rejects repository reorder payloads with missing or invalid repositoryIds", () => {
    const decode = Schema.decodeUnknownSync(
      repositoryContracts.reorder.request,
    );
    expect(() => decode({})).toThrow();
    expect(() => decode({ repositoryIds: "a" })).toThrow();
    expect(() => decode({ repositoryIds: [] })).toThrow();
    expect(() => decode({ repositoryIds: [1, 2] })).toThrow();
  });

  it("accepts valid repository remove and openInFinder payloads", () => {
    const remove = Schema.decodeUnknownSync(repositoryContracts.remove.request);
    const openInFinder = Schema.decodeUnknownSync(
      repositoryContracts.openInFinder.request,
    );
    expect(remove({ repositoryId: "repo-1" })).toEqual({
      repositoryId: "repo-1",
    });
    expect(openInFinder({ repositoryId: "repo-1" })).toEqual({
      repositoryId: "repo-1",
    });
  });

  it("rejects repository remove payloads with invalid repositoryId", () => {
    const decode = Schema.decodeUnknownSync(repositoryContracts.remove.request);
    expect(() => decode({ repositoryId: null })).toThrow();
  });
});

describe("worktreeContracts request schemas", () => {
  it("accepts valid worktree create payloads", () => {
    const decode = Schema.decodeUnknownSync(worktreeContracts.create.request);
    expect(
      decode({ repositoryId: "repo-1", branchName: "feature/runtime" }),
    ).toEqual({
      repositoryId: "repo-1",
      branchName: "feature/runtime",
    });
  });

  it("rejects worktree create payloads missing required fields", () => {
    const decode = Schema.decodeUnknownSync(worktreeContracts.create.request);
    expect(() => decode({ repositoryId: "repo-1" })).toThrow();
    expect(() => decode({ branchName: "main" })).toThrow();
    expect(() => decode({ repositoryId: 1, branchName: "main" })).toThrow();
  });

  it("accepts valid worktree select and remove payloads", () => {
    const select = Schema.decodeUnknownSync(worktreeContracts.select.request);
    const remove = Schema.decodeUnknownSync(worktreeContracts.remove.request);
    expect(select({ worktreeId: "wt-1" })).toEqual({ worktreeId: "wt-1" });
    expect(remove({ worktreeId: "wt-1" })).toEqual({ worktreeId: "wt-1" });
  });

  it("rejects worktree select payloads with invalid worktreeId", () => {
    const decode = Schema.decodeUnknownSync(worktreeContracts.select.request);
    expect(() => decode({ worktreeId: [] })).toThrow();
  });
});

describe("threadContracts request schemas", () => {
  it("accepts valid thread create payloads", () => {
    const decode = Schema.decodeUnknownSync(threadContracts.create.request);
    expect(decode({ worktreeId: "wt-1" })).toEqual({ worktreeId: "wt-1" });
  });

  it("rejects thread create payloads with missing or invalid worktreeId", () => {
    const decode = Schema.decodeUnknownSync(threadContracts.create.request);
    expect(() => decode({})).toThrow();
    expect(() => decode({ worktreeId: 9 })).toThrow();
  });

  it("accepts valid thread select and delete payloads", () => {
    const select = Schema.decodeUnknownSync(threadContracts.select.request);
    const del = Schema.decodeUnknownSync(threadContracts.delete.request);
    expect(select({ threadId: "thread-1" })).toEqual({
      threadId: "thread-1",
    });
    expect(del({ threadId: "thread-1" })).toEqual({ threadId: "thread-1" });
  });

  it("rejects thread delete payloads with invalid threadId", () => {
    const decode = Schema.decodeUnknownSync(threadContracts.delete.request);
    expect(() => decode({ threadId: undefined })).toThrow();
  });

  it("accepts thread create string responses", () => {
    const decode = Schema.decodeUnknownSync(threadContracts.create.response);
    expect(decode("thread-created")).toBe("thread-created");
  });

  it("rejects thread create responses that are not strings", () => {
    const decode = Schema.decodeUnknownSync(threadContracts.create.response);
    expect(() => decode(42)).toThrow();
  });
});
