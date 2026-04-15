import path from "node:path";
import {
  type AgentSnapshot,
  getActiveRepository,
  getActiveWorktree,
  type ShellAgentMode,
  type ShellCatalogSnapshot,
  type ShellGitSnapshot,
  type ShellSnapshot,
  type ThreadSnapshot,
} from "@pi-desktop/shared";
import type {
  GitRepositoryInspection,
  GitWorktreeSummary,
} from "./git-worktree-service";
import { GitWorktreeService } from "./git-worktree-service";

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
  agentSnapshot?: AgentSnapshot | null;
  selectedThread?: {
    id: string;
    title: string;
    lastActivityAt: number | null;
    createdAt?: number;
  };
  catalog?: ShellCatalogSnapshot;
}

const gitService = new GitWorktreeService();

function resolveAgentMode(agentMode?: string): ShellAgentMode {
  if (agentMode === "mock" || agentMode === "sdk" || agentMode === "cli") {
    return agentMode;
  }

  return "unknown";
}

function createEmptyCatalog(): ShellCatalogSnapshot {
  return {
    repositories: [],
    selection: {
      repositoryId: null,
      worktreeId: null,
      threadId: null,
    },
  };
}

function createWorkspaceProjects(
  appName: string,
  catalog: ShellCatalogSnapshot,
): NonNullable<ShellSnapshot["workspace"]>["projects"] {
  const activeRepository = getActiveRepository({ catalog });

  return catalog.repositories.map((repository) => ({
    id: repository.id,
    name: repository.customName?.trim() || repository.name || appName,
    path: repository.rootPath,
    isActive: repository.id === activeRepository?.id,
  }));
}

function toShellGitSnapshot(
  inspection: GitRepositoryInspection,
): ShellGitSnapshot {
  if (inspection.status === "repository") {
    return (
      inspection.currentGit ?? {
        status: "repository",
        rootPath: inspection.rootPath,
        message: inspection.message,
      }
    );
  }

  return {
    status: inspection.status,
    message: inspection.message,
  };
}

function createThreadSnapshot(options: {
  agentSnapshot?: AgentSnapshot | null;
  selectedThread: {
    id: string;
    title: string;
    lastActivityAt: number | null;
    createdAt?: number;
  };
}): ThreadSnapshot {
  const { agentSnapshot, selectedThread } = options;
  const lastMessage =
    agentSnapshot?.messages[agentSnapshot.messages.length - 1];

  return {
    id: selectedThread.id,
    title: selectedThread.title,
    lastActivityAt:
      selectedThread.lastActivityAt ?? lastMessage?.timestamp ?? null,
    createdAt: selectedThread.createdAt,
    runtime: {
      status: agentSnapshot?.status ?? "starting",
      lastError: agentSnapshot?.lastError ?? null,
    },
  };
}

function createWorktreeLabel(
  worktree: GitWorktreeSummary,
  appName: string,
): string {
  if (worktree.branch) {
    return worktree.branch;
  }

  if (worktree.isDetached) {
    return `Detached ${worktree.commit ?? ""}`.trim();
  }

  return path.basename(worktree.path) || appName;
}

function createCatalog(options: {
  appName: string;
  inspection: GitRepositoryInspection;
  agentSnapshot?: AgentSnapshot | null;
  selectedThread?: {
    id: string;
    title: string;
    lastActivityAt: number | null;
  };
}): ShellCatalogSnapshot {
  const { appName, inspection, agentSnapshot, selectedThread } = options;

  if (
    inspection.status !== "repository" ||
    !inspection.rootPath ||
    !inspection.currentWorktreePath ||
    !inspection.worktrees
  ) {
    return createEmptyCatalog();
  }

  const repositoryRoot = inspection.rootPath;
  const currentWorktreePath = inspection.currentWorktreePath;

  const thread = selectedThread
    ? createThreadSnapshot({ agentSnapshot, selectedThread })
    : null;

  return {
    repositories: [
      {
        id: repositoryRoot,
        name: path.basename(repositoryRoot) || appName,
        rootPath: repositoryRoot,
        defaultBranch: inspection.defaultBranch ?? null,
        worktrees: inspection.worktrees.map((worktree) => ({
          id: worktree.path,
          label: createWorktreeLabel(worktree, appName),
          path: worktree.path,
          isMain: worktree.isMain,
          isDetached: worktree.isDetached,
          git: worktree.git,
          threads:
            thread && worktree.path === currentWorktreePath ? [thread] : [],
          createdAt:
            thread && worktree.path === currentWorktreePath
              ? thread.createdAt
              : undefined,
        })),
      },
    ],
    selection: selectedThread
      ? {
          repositoryId: repositoryRoot,
          worktreeId: currentWorktreePath,
          threadId: selectedThread.id,
        }
      : {
          repositoryId: repositoryRoot,
          worktreeId: currentWorktreePath,
          threadId: null,
        },
  };
}

function toShellGitSnapshotFromCatalog(
  catalog: ShellCatalogSnapshot,
): ShellGitSnapshot | null {
  const repository = getActiveRepository({ catalog });
  const worktree = getActiveWorktree({ catalog });

  if (!repository || !worktree || worktree.git.status !== "ready") {
    return null;
  }

  return {
    status: "repository",
    rootPath: repository.rootPath,
    branch: worktree.isDetached ? "HEAD" : (worktree.git.branch ?? undefined),
    commit: worktree.git.commit ?? undefined,
    hasChanges: worktree.git.hasChanges,
    ahead: worktree.git.ahead ?? 0,
    behind: worktree.git.behind ?? 0,
    stagedCount: worktree.git.stagedCount,
    modifiedCount: worktree.git.modifiedCount,
    untrackedCount: worktree.git.untrackedCount,
    message: worktree.git.message,
  };
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
  agentSnapshot,
  selectedThread,
  catalog,
}: CreateShellSnapshotOptions): ShellSnapshot {
  const requestedPath = cwd ?? process.cwd();
  const activeCatalogWorktree = catalog ? getActiveWorktree({ catalog }) : null;
  const gitFromCatalog = catalog
    ? toShellGitSnapshotFromCatalog(catalog)
    : null;
  let inspection: GitRepositoryInspection | null = null;

  let git: ShellGitSnapshot;
  let activePath = activeCatalogWorktree?.path ?? requestedPath;

  if (gitFromCatalog) {
    git = gitFromCatalog;
  } else {
    inspection = gitService.inspect(requestedPath);
    git = toShellGitSnapshot(inspection);
    if (inspection.status === "repository" && inspection.currentWorktreePath) {
      activePath = inspection.currentWorktreePath;
    }
  }

  const resolvedCatalog =
    catalog ??
    createCatalog({
      appName,
      inspection: inspection ?? {
        status: "not_repo",
        message: null,
      },
      agentSnapshot,
      selectedThread,
    });

  return {
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
      agentDirectory: agentDir ?? null,
    },
    workspace: {
      rootPath: activePath,
      agentDirectory: agentDir ?? null,
      projects: createWorkspaceProjects(appName, resolvedCatalog),
    },
    catalog: resolvedCatalog,
    capabilities: {
      supportsTurns: true,
      supportsTools: true,
      supportsActivity: true,
      supportsParallelSessions: false,
    },
    git,
  };
}
