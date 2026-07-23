import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  GitCommitRequestSchema,
  GitDiffFileRequestSchema,
  GitFilePathRequestSchema,
  GitFilePathsRequestSchema,
  GitGetRepositoryStatusRequestSchema,
  GitRepositoryPathRequestSchema,
  GitRepositoryStatusSchema,
  gitContracts,
  MAX_COMMIT_MESSAGE_BYTES,
} from "./git.js";
import { MAX_IPC_STRING_BYTES } from "./schema-primitives.js";

describe("git request schemas", () => {
  it("accepts valid getRepositoryStatus payloads", () => {
    expect(
      Schema.decodeUnknownSync(GitGetRepositoryStatusRequestSchema)({
        repositoryPath: "/repo",
      }),
    ).toEqual({ repositoryPath: "/repo" });
    expect(
      Schema.decodeUnknownSync(GitGetRepositoryStatusRequestSchema)({
        repositoryPath: "/repo",
        force: true,
      }),
    ).toEqual({ repositoryPath: "/repo", force: true });
  });

  it("rejects getRepositoryStatus payloads with null bytes in repositoryPath", () => {
    expect(() =>
      Schema.decodeUnknownSync(GitGetRepositoryStatusRequestSchema)({
        repositoryPath: "/repo\0/evil",
      }),
    ).toThrow();
  });

  it("accepts valid repositoryPath-only payloads", () => {
    expect(
      Schema.decodeUnknownSync(GitRepositoryPathRequestSchema)({
        repositoryPath: "/tmp/new-repo",
      }),
    ).toEqual({ repositoryPath: "/tmp/new-repo" });
  });

  it("rejects repositoryPath-only payloads with missing or invalid repositoryPath", () => {
    expect(() =>
      Schema.decodeUnknownSync(GitRepositoryPathRequestSchema)({}),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(GitRepositoryPathRequestSchema)({
        repositoryPath: 42,
      }),
    ).toThrow();
  });

  it("accepts valid file path mutation payloads", () => {
    expect(
      Schema.decodeUnknownSync(GitFilePathRequestSchema)({
        repositoryPath: "/repo",
        filePath: "src/index.ts",
      }),
    ).toEqual({ repositoryPath: "/repo", filePath: "src/index.ts" });
  });

  it("rejects file path mutation payloads with missing fields", () => {
    expect(() =>
      Schema.decodeUnknownSync(GitFilePathRequestSchema)({
        repositoryPath: "/repo",
      }),
    ).toThrow();
  });

  it("accepts valid multi-file mutation payloads", () => {
    expect(
      Schema.decodeUnknownSync(GitFilePathsRequestSchema)({
        repositoryPath: "/repo",
        filePaths: ["a.ts", "b.ts"],
      }),
    ).toEqual({ repositoryPath: "/repo", filePaths: ["a.ts", "b.ts"] });
  });

  it("rejects empty filePaths arrays", () => {
    expect(() =>
      Schema.decodeUnknownSync(GitFilePathsRequestSchema)({
        repositoryPath: "/repo",
        filePaths: [],
      }),
    ).toThrow();
  });

  it("rejects filePaths arrays with non-string entries", () => {
    expect(() =>
      Schema.decodeUnknownSync(GitFilePathsRequestSchema)({
        repositoryPath: "/repo",
        filePaths: ["ok", 1],
      }),
    ).toThrow();
  });

  it("accepts valid diffFile payloads", () => {
    expect(
      Schema.decodeUnknownSync(GitDiffFileRequestSchema)({
        repositoryPath: "/repo",
        filePath: "README.md",
        staged: false,
      }),
    ).toEqual({
      repositoryPath: "/repo",
      filePath: "README.md",
      staged: false,
    });
  });

  it("accepts valid commit payloads", () => {
    expect(
      Schema.decodeUnknownSync(GitCommitRequestSchema)({
        repositoryPath: "/repo",
        message: "feat: ship it",
      }),
    ).toEqual({ repositoryPath: "/repo", message: "feat: ship it" });
  });

  it("rejects commit payloads with oversized messages", () => {
    expect(() =>
      Schema.decodeUnknownSync(GitCommitRequestSchema)({
        repositoryPath: "/repo",
        message: "x".repeat(MAX_COMMIT_MESSAGE_BYTES + 1),
      }),
    ).toThrow();
  });

  it("rejects repository paths exceeding the IPC string cap", () => {
    expect(() =>
      Schema.decodeUnknownSync(GitRepositoryPathRequestSchema)({
        repositoryPath: "a".repeat(MAX_IPC_STRING_BYTES + 1),
      }),
    ).toThrow();
  });
});

describe("git response schemas", () => {
  it("accepts GitRepositoryStatus-shaped responses", () => {
    const decode = Schema.decodeUnknownSync(GitRepositoryStatusSchema);
    expect(
      decode({
        repositoryPath: "/repo",
        branch: "main",
        commit: "abc123",
        upstreamBranch: "origin/main",
        summary: {
          status: "ready",
          branch: "main",
          commit: "abc123",
          hasChanges: true,
          ahead: 0,
          behind: 0,
          stagedCount: 1,
          modifiedCount: 2,
          untrackedCount: 0,
          message: null,
        },
        stagedChanges: [],
        unstagedChanges: [],
        conflictedChanges: [],
      }),
    ).toMatchObject({ branch: "main" });
  });

  it("accepts boolean isRepository responses", () => {
    const decode = Schema.decodeUnknownSync(gitContracts.isRepository.response);
    expect(decode(true)).toBe(true);
    expect(decode(false)).toBe(false);
  });

  it("rejects isRepository responses that are not booleans", () => {
    const decode = Schema.decodeUnknownSync(gitContracts.isRepository.response);
    expect(() => decode("yes")).toThrow();
  });
});
