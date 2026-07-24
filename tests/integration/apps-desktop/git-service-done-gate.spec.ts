import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createGitService } from "../../../apps/desktop/src/main/git/git-service";

const MAIN_DIR = path.resolve(__dirname, "../../../apps/desktop/src/main");
const GIT_DIR = path.join(MAIN_DIR, "git");

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
      "git-service-impl.ts",
      "types.ts",
    ];

    for (const fileName of required) {
      expect(fs.existsSync(path.join(GIT_DIR, fileName))).toBe(true);
    }
  });

  it("god facade file is gone from main root; callers use createGitService", () => {
    expect(fs.existsSync(path.join(MAIN_DIR, "git-worktree-service.ts"))).toBe(
      false,
    );
    const bootstrap = fs.readFileSync(
      path.join(MAIN_DIR, "bootstrap/bootstrap-desktop.ts"),
      "utf8",
    );
    expect(bootstrap).toContain("createGitService");
    expect(bootstrap).not.toMatch(/new GitServiceImpl\s*\(/);
    expect(bootstrap).not.toMatch(/git-worktree-service/);
    const index = fs.readFileSync(path.join(MAIN_DIR, "index.ts"), "utf8");
    expect(index).toContain("bootstrapDesktop");
    expect(index.split("\n").length).toBeLessThan(20);
  });
});
