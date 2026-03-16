import { spawnSync } from "node:child_process";
import path from "node:path";
import type {
  ShellAgentMode,
  ShellGitSnapshot,
  ShellSnapshot,
} from "@pidesk/shared";

export interface CreateShellSnapshotOptions {
  appName: string;
  appVersion: string;
  chromeVersion?: string;
  electronVersion?: string;
  platform: NodeJS.Platform | string;
  env: Record<string, string | undefined>;
  isPackaged: boolean;
  cwd?: string;
  agentDir?: string;
  agentMode?: string;
}

function resolveAgentMode(agentMode?: string): ShellAgentMode {
  if (agentMode === "mock" || agentMode === "sdk") {
    return agentMode;
  }

  return "unknown";
}

export function createShellSnapshot({
  appName,
  appVersion,
  chromeVersion,
  electronVersion,
  platform,
  env,
  isPackaged,
  cwd,
  agentDir,
  agentMode,
}: CreateShellSnapshotOptions): ShellSnapshot {
  const rootPath = cwd ?? process.cwd();
  const projectName = path.basename(rootPath) || appName;

  // Detect git repository state for the renderer. This is intentionally
  // synchronous because snapshot creation is sync. Keep parsing defensive and
  // fail gracefully if git is unavailable or the cwd is not a repository.
  function detectGitSnapshot(repoPath: string): ShellGitSnapshot {
    // Default not_repo state
    const notRepo = {
      status: "not_repo",
      message: null,
    } as const;

    // Quick check: ensure git binary is present
    try {
      const v = spawnSync("git", ["--version"], {
        cwd: repoPath,
        encoding: "utf8",
      });
      if (v.error) {
        return {
          status: "unavailable",
          message: String(v.error?.message ?? "git binary unavailable"),
        };
      }
    } catch (err: unknown) {
      return {
        status: "unavailable",
        message: err instanceof Error ? err.message : String(err),
      };
    }

    // Check whether we're inside a git repository and find the repo root
    try {
      const rev = spawnSync("git", ["rev-parse", "--show-toplevel"], {
        cwd: repoPath,
        encoding: "utf8",
      });
      if (rev.error) {
        return {
          status: "unavailable",
          message: String(rev.error.message ?? "error running git rev-parse"),
        };
      }

      if (rev.status !== 0 || !rev.stdout) {
        // not a repository
        return notRepo;
      }

      const repoRoot = rev.stdout.trim();

      // Use porcelain=2 --branch to get branch/oid/ahead-behind when available
      const statusCmd = spawnSync(
        "git",
        ["status", "--porcelain=2", "--branch"],
        { cwd: repoPath, encoding: "utf8" },
      );
      if (statusCmd.error) {
        return {
          status: "unavailable",
          message: String(
            statusCmd.error.message ?? "error running git status",
          ),
        };
      }

      const out = String(statusCmd.stdout ?? "");
      const lines = out.split(/\r?\n/);

      let branch: string | undefined;
      let commit: string | undefined;
      let ahead: number | undefined;
      let behind: number | undefined;

      for (const line of lines) {
        if (!line) continue;
        if (line.startsWith("# branch.head ")) {
          branch = line.replace(/^# branch\.head\s+/, "").trim();
          continue;
        }
        if (line.startsWith("# branch.oid ")) {
          const oid = line.replace(/^# branch\.oid\s+/, "").trim();
          if (oid && oid !== "(initial)") {
            commit = oid.slice(0, 7);
          }
          continue;
        }
        if (line.startsWith("# branch.ab ")) {
          // format: # branch.ab +<ahead> -<behind>
          const m = line.match(/^# branch\.ab \+(\d+) -(\d+)/);
          if (m) {
            ahead = Number(m[1]);
            behind = Number(m[2]);
          }
        }
      }

      // As a fallback for commit when porcelain header isn't present, try rev-parse --short HEAD
      if (!commit) {
        const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
          cwd: repoPath,
          encoding: "utf8",
        });
        if (!r.error && r.status === 0 && r.stdout) {
          commit = String(r.stdout).trim();
        }
      }

      // For working-tree counts, use porcelain (simple two-char format) which is easier to parse
      let stagedCount = 0;
      let modifiedCount = 0;
      let untrackedCount = 0;

      const porcelain = spawnSync("git", ["status", "--porcelain"], {
        cwd: repoPath,
        encoding: "utf8",
      });
      if (!porcelain.error && porcelain.status === 0 && porcelain.stdout) {
        const pLines = String(porcelain.stdout).split(/\r?\n/);
        for (const pl of pLines) {
          if (!pl) continue;
          // untracked
          if (pl.startsWith("??")) {
            untrackedCount++;
            continue;
          }

          // porcelain short format: XY <path> where X=index, Y=worktree
          const x = pl[0];
          const y = pl[1];
          if (x && x !== " ") stagedCount++;
          if (y && y !== " ") modifiedCount++;
        }
      }

      const hasChanges = stagedCount + modifiedCount + untrackedCount > 0;

      const snapshot: ShellGitSnapshot = {
        status: "repository",
        rootPath: repoRoot,
        branch,
        commit,
        hasChanges,
        ahead,
        behind,
        stagedCount,
        modifiedCount,
        untrackedCount,
        message: null,
      };

      return snapshot;
    } catch (err: unknown) {
      return {
        status: "unavailable",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const git = detectGitSnapshot(rootPath);

  const snapshot = {
    appName,
    appVersion,
    chromeVersion: chromeVersion ?? "unknown",
    platform,
    mode:
      env.NODE_ENV === "test"
        ? "test"
        : isPackaged
          ? "production"
          : "development",
    runtime: {
      agentMode: resolveAgentMode(agentMode),
      electronVersion,
    },
    workspace: {
      rootPath,
      agentDirectory: agentDir ?? null,
      projects: [
        {
          id: rootPath,
          name: projectName,
          path: rootPath,
          isActive: true,
        },
      ],
    },
    capabilities: {
      supportsTurns: true,
      supportsTools: true,
      supportsActivity: true,
      supportsParallelSessions: false,
    },
    git,
  };

  return snapshot as ShellSnapshot;
}
