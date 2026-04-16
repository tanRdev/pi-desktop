import { describe, expect, it } from "vitest";
import {
  createGitSnapshot,
  createRepository,
  createThread,
  createWorktree,
} from "./factories";

describe("test factories", () => {
  describe("createGitSnapshot", () => {
    it("returns ready defaults", () => {
      const git = createGitSnapshot();
      expect(git.status).toBe("ready");
      expect(git.branch).toBe("main");
      expect(git.hasChanges).toBe(false);
      expect(git.ahead).toBe(0);
    });

    it("applies overrides", () => {
      const git = createGitSnapshot({ status: "missing", branch: null });
      expect(git.status).toBe("missing");
      expect(git.branch).toBeNull();
      expect(git.commit).toBe("abc123");
    });
  });

  describe("createThread", () => {
    it("returns ready runtime by default", () => {
      const thread = createThread();
      expect(thread.id).toBe("thread-1");
      expect(thread.runtime.status).toBe("ready");
      expect(thread.runtime.lastError).toBeNull();
    });

    it("merges runtime overrides without losing defaults", () => {
      const thread = createThread({
        id: "t2",
        runtime: { status: "exited", lastError: "boom" },
      });
      expect(thread.id).toBe("t2");
      expect(thread.title).toBe("Thread");
      expect(thread.runtime.status).toBe("exited");
      expect(thread.runtime.lastError).toBe("boom");
    });
  });

  describe("createWorktree", () => {
    it("returns a main worktree with one ready thread", () => {
      const worktree = createWorktree();
      expect(worktree.isMain).toBe(true);
      expect(worktree.threads).toHaveLength(1);
      expect(worktree.git.status).toBe("ready");
    });

    it("honors git and threads overrides together", () => {
      const worktree = createWorktree({
        id: "wt-2",
        git: { hasChanges: true, modifiedCount: 3 },
        threads: [createThread({ id: "t-a" }), createThread({ id: "t-b" })],
      });
      expect(worktree.id).toBe("wt-2");
      expect(worktree.git.hasChanges).toBe(true);
      expect(worktree.git.modifiedCount).toBe(3);
      expect(worktree.git.branch).toBe("main");
      expect(worktree.threads.map((t) => t.id)).toEqual(["t-a", "t-b"]);
    });
  });

  describe("createRepository", () => {
    it("returns an Alpha Workspace repo with one worktree by default", () => {
      const repo = createRepository();
      expect(repo.name).toBe("Alpha Workspace");
      expect(repo.defaultBranch).toBe("main");
      expect(repo.worktrees).toHaveLength(1);
      expect(repo.worktrees[0]?.isMain).toBe(true);
    });

    it("applies overrides including custom worktrees array", () => {
      const repo = createRepository({
        id: "repo-9",
        name: "Gamma",
        worktrees: [createWorktree({ id: "wt-x", isMain: false })],
      });
      expect(repo.id).toBe("repo-9");
      expect(repo.name).toBe("Gamma");
      expect(repo.worktrees).toHaveLength(1);
      expect(repo.worktrees[0]?.id).toBe("wt-x");
      expect(repo.worktrees[0]?.isMain).toBe(false);
    });
  });
});
