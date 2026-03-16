import path from "node:path";
import type {
  AgentSnapshot,
  ShellAgentMode,
  ShellCatalogSnapshot,
  ShellGitSnapshot,
  ShellSnapshot,
  ThreadSnapshot,
} from "@pidesk/shared";
import type { GitRepositoryInspection, GitWorktreeSummary } from "./git-worktree-service";
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
  };
  catalog?: ShellCatalogSnapshot;
}

const DEFAULT_THREAD_ID = "default-thread";
const gitService = new GitWorktreeService();

function resolveAgentMode(agentMode?: string): ShellAgentMode {
  if (agentMode === "mock" || agentMode === "sdk") {
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

function toShellGitSnapshot(inspection: GitRepositoryInspection): ShellGitSnapshot {
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
  selectedThread?: {
    id: string;
    title: string;
    lastActivityAt: number | null;
  };
}): ThreadSnapshot {
  const { agentSnapshot, selectedThread } = options;
  const lastMessage = agentSnapshot?.messages[agentSnapshot.messages.length - 1];

  return {
    id: selectedThread?.id ?? DEFAULT_THREAD_ID,
    title: selectedThread?.title ?? "Current thread",
    isArchived: false,
    lastActivityAt: selectedThread?.lastActivityAt ?? lastMessage?.timestamp ?? null,
    runtime: {
      status: agentSnapshot?.status ?? "starting",
      lastError: agentSnapshot?.lastError ?? null,
    },
  };
}

function createWorktreeLabel(worktree: GitWorktreeSummary, appName: string): string {
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

  const thread = createThreadSnapshot({ agentSnapshot, selectedThread });
  const repositoryRoot = inspection.rootPath;
  const currentWorktreePath = inspection.currentWorktreePath;

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
          threads: worktree.path === currentWorktreePath ? [thread] : [],
        })),
      },
    ],
    selection: {
      repositoryId: repositoryRoot,
      worktreeId: currentWorktreePath,
      threadId: thread.id,
    },
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
  const inspection = gitService.inspect(requestedPath);
  const git = toShellGitSnapshot(inspection);
  const activePath =
    inspection.status === "repository" && inspection.currentWorktreePath
      ? inspection.currentWorktreePath
      : requestedPath;
  const projectName = path.basename(activePath) || appName;

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
      projects: [
        {
          id: activePath,
          name: projectName,
          path: activePath,
          isActive: true,
        },
      ],
    },
    catalog:
      catalog ??
      createCatalog({
        appName,
        inspection,
        agentSnapshot,
        selectedThread,
      }),
    capabilities: {
      supportsTurns: true,
      supportsTools: true,
      supportsActivity: true,
      supportsParallelSessions: false,
    },
    git,
  };
}
