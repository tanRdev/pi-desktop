import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RunGit } from "./git-command-runner";

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

describe("git file diff helpers", () => {
  it("finds the previous path for renamed files from porcelain status", async () => {
    const { resolveRenamedOldFilePath } = await import("./file-diff");

    const runGit: RunGit = (_cwd, args) => {
      expect(args).toEqual(["status", "--porcelain"]);

      return {
        status: 0,
        stdout: ["R  old-name.txt -> new-name.txt", "M  untouched.txt"].join(
          "\n",
        ),
        stderr: "",
        error: null,
      };
    };

    expect(resolveRenamedOldFilePath(runGit, "/repo", "new-name.txt")).toBe(
      "old-name.txt",
    );
  });

  it("builds a synthetic diff for untracked text files", async () => {
    const { buildUntrackedFileDiff } = await import("./file-diff");
    const repositoryPath = createTempDir("pi-desktop-git-file-diff-");
    const filePath = "notes.txt";

    writeFileSync(path.join(repositoryPath, filePath), "alpha\nbeta", "utf8");

    expect(buildUntrackedFileDiff(repositoryPath, filePath)).toEqual({
      filePath,
      oldFilePath: null,
      status: "untracked",
      hunks: [
        {
          oldStart: 0,
          oldCount: 0,
          newStart: 1,
          newCount: 2,
          lines: [
            {
              type: "add",
              content: "alpha",
              oldLineNumber: null,
              newLineNumber: 1,
            },
            {
              type: "add",
              content: "beta",
              oldLineNumber: null,
              newLineNumber: 2,
            },
          ],
        },
      ],
      binary: false,
    });
  });
});
