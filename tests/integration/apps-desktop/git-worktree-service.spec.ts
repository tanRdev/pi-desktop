import { execFileSync } from "node:child_process";
import { mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
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

function createBareGitRepository(): string {
  const repositoryPath = mkdtempSync(
    path.join(os.tmpdir(), "pi-desktop-git-worktree-service-remote-"),
  );
  tempDirs.push(repositoryPath);

  execFileSync("git", ["init", "--bare"], {
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

  it("returns the same inspection snapshot from sync and async APIs", async () => {
    const repositoryPath = createGitRepository();
    const syncService = new GitWorktreeService();
    const asyncService = new GitWorktreeService();

    writeFileSync(
      path.join(repositoryPath, "pending.txt"),
      "pending\n",
      "utf8",
    );

    const syncInspection = syncService.inspect(repositoryPath);
    const asyncInspection = await asyncService.inspectAsync(repositoryPath);

    expect(asyncInspection).toEqual(syncInspection);
  });

  it("reports the tracked upstream branch in repository status", () => {
    const repositoryPath = createGitRepository();
    const remoteRepositoryPath = createBareGitRepository();
    const service = new GitWorktreeService();

    execFileSync("git", ["remote", "add", "origin", remoteRepositoryPath], {
      cwd: repositoryPath,
      encoding: "utf8",
    });

    const branchName = execFileSync("git", ["branch", "--show-current"], {
      cwd: repositoryPath,
      encoding: "utf8",
    }).trim();

    execFileSync("git", ["push", "-u", "origin", branchName], {
      cwd: repositoryPath,
      encoding: "utf8",
    });

    const status = service.getRepositoryStatus(repositoryPath);

    expect(status.upstreamBranch).toBe(`origin/${branchName}`);
  });

  it("delegates repository status assembly through an extracted helper seam", async () => {
    const [source, helperSource] = await Promise.all([
      readFile(
        new URL(
          "../../../apps/desktop/src/main/git-worktree-service.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../../apps/desktop/src/main/git/repository-status-loader.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

    expect(source).toContain('from "./git/repository-status-loader"');
    expect(source).toContain("const status = loadRepositoryStatus({");
    expect(source).not.toContain(
      "const currentWorktree = inspection.worktrees.find(",
    );
    expect(source).not.toContain("const porcelainResult = this.runGit(");

    expect(helperSource).toContain("export function loadRepositoryStatus");
    expect(helperSource).toContain("return buildRepositoryStatus({");
    expect(helperSource).toContain(
      "input.resolveUpstreamBranch ?? resolveUpstreamBranch",
    );
  });

  it("delegates repository inspection loading through an extracted helper seam", async () => {
    const [source, helperSource] = await Promise.all([
      readFile(
        new URL(
          "../../../apps/desktop/src/main/git-worktree-service.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../../apps/desktop/src/main/git/repository-inspection-loader.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

    expect(source).toContain('from "./git/repository-inspection-loader"');
    expect(source).toContain("const inspection = loadRepositoryInspection({");
    expect(source).toContain(
      "const inspection = await loadRepositoryInspectionAsync({",
    );
    expect(source).not.toContain(
      "const currentWorktreeRoot = resolveCurrentWorktreeRoot(",
    );
    expect(source).not.toContain(
      "const currentWorktreeRoot = await resolveCurrentWorktreeRootAsync(",
    );
    expect(source).not.toContain(
      "const worktreeList = this.runGit(currentWorktreeRoot, [",
    );
    expect(source).not.toContain(
      "const worktreeList = await this.runGitAsync(currentWorktreeRoot, [",
    );
    expect(source).not.toContain(
      "const parsedWorktrees = parseWorktreeBlocks(",
    );
    expect(source).not.toContain("const defaultBranch = detectDefaultBranch(");
    expect(source).not.toContain(
      "const defaultBranch = await detectDefaultBranchAsync(",
    );

    expect(helperSource).toContain("export function loadRepositoryInspection");
    expect(helperSource).toContain(
      "export async function loadRepositoryInspectionAsync",
    );
    expect(helperSource).toContain(
      "const commandCwd = input.resolveCommandCwd(input.targetPath)",
    );
    expect(helperSource).toContain(
      "const parsedWorktrees = input.parseWorktreeList(worktreeList.stdout)",
    );
    expect(helperSource).toContain("return input.buildInspection({");
  });

  it("delegates Effect wrappers through an extracted helper seam", async () => {
    const [source, helperSource] = await Promise.all([
      readFile(
        new URL(
          "../../../apps/desktop/src/main/git-worktree-service.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../../apps/desktop/src/main/git/effect-wrappers.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

    expect(source).toContain('from "./git/effect-wrappers"');
    expect(source).toContain("return createGitSyncEffect({");
    expect(source).toContain("return createGitAsyncEffect({");
    expect(source).not.toContain("return Effect.try({");
    expect(source).not.toContain("return Effect.tryPromise({");

    expect(helperSource).toContain("export function createGitSyncEffect");
    expect(helperSource).toContain("export function createGitAsyncEffect");
    expect(helperSource).toContain("return Effect.try({");
    expect(helperSource).toContain("return Effect.tryPromise({");
  });

  it("delegates status-changing command assembly through an extracted helper seam", async () => {
    const [source, helperSource] = await Promise.all([
      readFile(
        new URL(
          "../../../apps/desktop/src/main/git-worktree-service.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../../apps/desktop/src/main/git/status-changing-commands.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

    expect(source).toContain('from "./git/status-changing-commands"');
    expect(source).toContain("buildStageFileCommand(filePath)");
    expect(source).toContain("buildStageFilesCommand(filePaths)");
    expect(source).toContain("buildUnstageFileCommand(filePath)");
    expect(source).toContain("buildUnstageFilesCommand(filePaths)");
    expect(source).toContain("buildDiscardTrackedFileCommand(filePath)");
    expect(source).toContain("buildCommitCommand(trimmed)");
    expect(source).toContain("buildPullCommand()");
    expect(source).toContain("buildPushCommand()");
    expect(source).toContain("buildFetchCommand()");
    expect(source).not.toContain('args: ["add", "--", filePath]');
    expect(source).not.toContain('args: ["add", "--", ...filePaths]');
    expect(source).not.toContain(
      'args: ["restore", "--staged", "--", filePath]',
    );
    expect(source).not.toContain(
      'args: ["restore", "--staged", "--", ...filePaths]',
    );
    expect(source).not.toContain(
      'args: ["restore", "--worktree", "--", filePath]',
    );
    expect(source).not.toContain('args: ["commit", "-m", trimmed]');
    expect(source).not.toContain('args: ["pull", "--ff-only"]');
    expect(source).not.toContain('args: ["push"]');
    expect(source).not.toContain('args: ["fetch", "--all", "--prune"]');

    expect(helperSource).toContain("export function buildStageFileCommand");
    expect(helperSource).toContain("export function buildStageFilesCommand");
    expect(helperSource).toContain("export function buildUnstageFileCommand");
    expect(helperSource).toContain("export function buildUnstageFilesCommand");
    expect(helperSource).toContain(
      "export function buildDiscardTrackedFileCommand",
    );
    expect(helperSource).toContain("export function buildCommitCommand");
    expect(helperSource).toContain("export function buildPullCommand");
    expect(helperSource).toContain("export function buildPushCommand");
    expect(helperSource).toContain("export function buildFetchCommand");
  });

  it("delegates status-changing command execution through an extracted helper seam", async () => {
    const [source, helperSource] = await Promise.all([
      readFile(
        new URL(
          "../../../apps/desktop/src/main/git-worktree-service.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../../apps/desktop/src/main/git/status-changing-command-runner.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

    expect(source).toContain('from "./git/status-changing-command-runner"');
    expect(source).toContain(
      "private readonly runStatusChangingCommand = createStatusChangingCommandRunner(",
    );
    expect(source).toContain("return this.runStatusChangingCommand(");
    expect(source).not.toContain("return runCheckedGitStatusCommand({");

    expect(source).toContain("buildStageFileCommand(filePath)");
    expect(source).toContain("buildStageFilesCommand(filePaths)");
    expect(source).toContain("buildUnstageFileCommand(filePath)");
    expect(source).toContain("buildUnstageFilesCommand(filePaths)");
    expect(source).toContain("buildDiscardTrackedFileCommand(filePath)");
    expect(source).toContain("buildCommitCommand(trimmed)");
    expect(source).toContain("buildPullCommand()");
    expect(source).toContain("buildPushCommand()");
    expect(source).toContain("buildFetchCommand()");

    expect(helperSource).toContain(
      "export function createStatusChangingCommandRunner",
    );
    expect(helperSource).toContain("return runCheckedGitStatusCommand({");
    expect(helperSource).toContain(
      "clearCachesForPath: input.clearCachesForPath",
    );
    expect(helperSource).toContain(
      "getRepositoryStatus: input.getRepositoryStatus",
    );
  });
});
