import { execFileSync } from "node:child_process";
import { mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GitWorktreeService } from "../../../apps/desktop/src/main/git-worktree-service";

const tempDirs: string[] = [];

function createGitRepository(): string {
  const repositoryPath = mkdtempSync(
    path.join(os.tmpdir(), "pi-desktop-git-worktree-service-"),
  );
  tempDirs.push(repositoryPath);

  execFileSync("git", ["init"], { cwd: repositoryPath, encoding: "utf8" });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: repositoryPath,
    encoding: "utf8",
  });
  execFileSync("git", ["config", "user.name", "Pi Desktop Tests"], {
    cwd: repositoryPath,
    encoding: "utf8",
  });

  writeFileSync(path.join(repositoryPath, "old-name.txt"), "hello\n", "utf8");
  execFileSync("git", ["add", "old-name.txt"], {
    cwd: repositoryPath,
    encoding: "utf8",
  });
  execFileSync("git", ["commit", "-m", "initial"], {
    cwd: repositoryPath,
    encoding: "utf8",
  });

  return repositoryPath;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("GitWorktreeService diffFile", () => {
  it("returns the previous path for staged renames", () => {
    const repositoryPath = createGitRepository();
    const service = new GitWorktreeService();

    renameSync(
      path.join(repositoryPath, "old-name.txt"),
      path.join(repositoryPath, "new-name.txt"),
    );
    execFileSync("git", ["add", "-A"], {
      cwd: repositoryPath,
      encoding: "utf8",
    });

    const diff = service.diffFile(repositoryPath, "new-name.txt", true);

    expect(diff.status).toBe("renamed");
    expect(diff.oldFilePath).toBe("old-name.txt");
    expect(diff.filePath).toBe("new-name.txt");
  });
});
