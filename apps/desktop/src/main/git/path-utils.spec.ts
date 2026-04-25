import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  normalizePathId,
  resolveCommandCwd,
  resolveInsideRepository,
} from "./path-utils";
import {
  parseGitFileChange,
  parseRenamedOldFilePathFromStatus,
  parseWorktreeBlocks,
} from "./status-parsers";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(directory);
  return directory;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    tempDirs
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("git path helpers", () => {
  it("resolves file targets to their parent working directory", () => {
    const repositoryPath = createTempDir("pi-desktop-git-path-utils-");
    const filePath = path.join(repositoryPath, "nested", "file.txt");

    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, "hello", { encoding: "utf8", flush: true });

    expect(resolveCommandCwd(filePath)).toBe(path.dirname(filePath));
  });

  it("rejects repository traversal attempts", () => {
    const repositoryPath = createTempDir("pi-desktop-git-path-utils-");

    expect(() =>
      resolveInsideRepository(repositoryPath, "../escape.txt"),
    ).toThrow(/outside repository/);
  });

  it("normalizes trailing separators", () => {
    const repositoryPath = createTempDir("pi-desktop-git-path-utils-");
    const withTrailingSeparator = `${repositoryPath}${path.sep}`;

    expect(normalizePathId(withTrailingSeparator)).toBe(
      normalizePathId(repositoryPath),
    );
  });
});

describe("git status parsers", () => {
  it("parses renamed files from porcelain output", () => {
    expect(parseGitFileChange("R  old-name.txt -> new-name.txt")).toEqual({
      path: "new-name.txt",
      status: "renamed",
      indexStatus: "renamed",
      worktreeStatus: null,
    });
  });

  it("finds the old path for a renamed file", () => {
    const statusOutput = [
      "R  old-name.txt -> new-name.txt",
      "M  untouched.txt",
    ].join("\n");

    expect(
      parseRenamedOldFilePathFromStatus(statusOutput, "new-name.txt"),
    ).toBe("old-name.txt");
  });

  it("parses porcelain worktree blocks", () => {
    const worktreeRoot = normalizePathId(
      createTempDir("pi-desktop-git-worktree-"),
    );
    const linkedWorktree = normalizePathId(
      createTempDir("pi-desktop-git-worktree-"),
    );
    const output = [
      `worktree ${worktreeRoot}`,
      "HEAD 0123456789abcdef",
      "branch refs/heads/main",
      "",
      `worktree ${linkedWorktree}`,
      "HEAD fedcba9876543210",
      "detached",
      "prunable gitdir file points to non-existent location",
    ].join("\n");

    expect(parseWorktreeBlocks(output)).toEqual([
      {
        path: worktreeRoot,
        head: "0123456789abcdef",
        branchRef: "refs/heads/main",
        detached: false,
        prunableReason: null,
      },
      {
        path: linkedWorktree,
        head: "fedcba9876543210",
        branchRef: null,
        detached: true,
        prunableReason: "gitdir file points to non-existent location",
      },
    ]);
  });
});
