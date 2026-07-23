import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createGitService } from "../../../apps/desktop/src/main/git/git-service";

const GIT_DIR = path.resolve(__dirname, "../../../apps/desktop/src/main/git");

describe("Spine 4 Git Service done-gate", () => {
  it("exposes createGitService as the caller-facing factory", () => {
    const service = createGitService();
    expect(typeof service.inspect).toBe("function");
    expect(typeof service.getRepositoryStatus).toBe("function");
    expect(typeof service.createWorktree).toBe("function");
    expect(typeof service.diffFile).toBe("function");
  });

  it("keeps focused modules for status, worktrees, diff, staging, and cache", () => {
    const required = [
      "repository-status.ts",
      "worktree-creation.ts",
      "file-diff.ts",
      "status-changing-commands.ts",
      "cache-invalidation.ts",
      "git-service.ts",
    ];

    for (const fileName of required) {
      expect(fs.existsSync(path.join(GIT_DIR, fileName))).toBe(true);
    }
  });

  it("main bootstrap constructs Git via createGitService, not new GitWorktreeService", () => {
    const index = fs.readFileSync(
      path.resolve(__dirname, "../../../apps/desktop/src/main/index.ts"),
      "utf8",
    );
    expect(index).toContain("createGitService");
    expect(index).not.toMatch(/new GitWorktreeService\s*\(/);
  });
});
