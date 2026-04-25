import os from "node:os";
import path from "node:path";
import type {
  AgentSnapshot,
  RepositoryPreferences,
  ShellCatalogSnapshot,
  ThreadSnapshot,
  WorkspaceSession,
} from "@pi-desktop/shared";
import type {
  GitRepositoryInspection,
  GitWorktreeSummary,
} from "./git-worktree-service";
import { reconcileWorkspaceSessions } from "./shell-catalog-builder-workspace-sessions";

const PI_DESKTOP_WORKTREES_DIR = path.join(os.homedir(), ".pi-desktop");

function isPiDesktopWorktree(worktreePath: string): boolean {
  const normalized = path.resolve(worktreePath);
  const normalizedBase = path.resolve(PI_DESKTOP_WORKTREES_DIR);
  return (
    normalized.startsWith(normalizedBase + path.sep) ||
    normalized === normalizedBase
  );
}

import type { RepositoryCatalogEntry } from "./repository-catalog";
import type { AppSelectionState } from "./selection-state";
import type { ThreadCatalogEntry } from "./thread-catalog";
import type { ThreadRuntimeRef } from "./thread-runtime-manager";

export interface BuildShellCatalogOptions {
  repositories: RepositoryCatalogEntry[];
  selection: AppSelectionState;
  repositoryPreferences?: RepositoryPreferences[];
  workspaceSessions?: WorkspaceSession[];
  inspectRepository: (
    rootPath: string,
  ) => GitRepositoryInspection | Promise<GitRepositoryInspection>;
  listThreadsByWorktree: (worktreeId: string) => ThreadCatalogEntry[];
  getRuntimeState: (thread: ThreadRuntimeRef) => Promise<{
    status: ThreadSnapshot["runtime"]["status"];
    lastError: string | null;
  }>;
  selectedAgentSnapshot?: AgentSnapshot | null;
}

function createWorktreeLabel(
  worktree: GitWorktreeSummary,
  fallbackName: string,
): string {
  if (worktree.branch) {
    return worktree.branch;
  }

  if (worktree.isDetached) {
    return `Detached ${worktree.commit ?? ""}`.trim();
  }

  return path.basename(worktree.path) || fallbackName;
}

function createFolderWorkspaceSnapshot(options: {
  rootPath: string;
  fallbackName: string;
  threads: ThreadSnapshot[];
  createdAt?: number;
}): ShellCatalogSnapshot["repositories"][number]["worktrees"][number] {
  const { rootPath, fallbackName, threads, createdAt } = options;

  return {
    id: rootPath,
    label: path.basename(rootPath) || fallbackName,
    path: rootPath,
    isMain: true,
    isDetached: false,
    git: {
      status: "unavailable",
      branch: null,
      commit: null,
      hasChanges: false,
      ahead: null,
      behind: null,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: "Git unavailable",
    },
    threads,
    createdAt,
  };
}

function reconcileSelection(
  repositories: ShellCatalogSnapshot["repositories"],
  selection: AppSelectionState,
): AppSelectionState {
  const repository =
    repositories.find((item) => item.id === selection.repositoryId) ??
    repositories.find((item) => item.worktrees.length > 0) ??
    repositories[0] ??
    null;

  if (!repository) {
    return {
      repositoryId: null,
      worktreeId: null,
      threadId: null,
    };
  }

  if (repository.worktrees.length === 0) {
    return {
      repositoryId: repository.id,
      worktreeId: null,
      threadId: null,
    };
  }

  const worktree = repository
    ? (repository.worktrees.find((item) => item.id === selection.worktreeId) ??
      repository.worktrees[0] ??
      null)
    : null;
  const thread = worktree
    ? (worktree.threads.find((item) => item.id === selection.threadId) ??
      worktree.threads[0] ??
      null)
    : null;

  return {
    repositoryId: repository?.id ?? null,
    worktreeId: worktree?.id ?? null,
    threadId: thread?.id ?? null,
  };
}

async function createThreadSnapshot(
  thread: ThreadCatalogEntry,
  worktreePath: string,
  getRuntimeState: BuildShellCatalogOptions["getRuntimeState"],
  selectedThreadId: string | null,
  selectedAgentSnapshot?: AgentSnapshot | null,
): Promise<ThreadSnapshot> {
  const runtimeState =
    thread.id === selectedThreadId && selectedAgentSnapshot
      ? {
          status: selectedAgentSnapshot.status,
          lastError: selectedAgentSnapshot.lastError,
        }
      : await getRuntimeState({
          threadId: thread.id,
          worktreePath,
        });

  return {
    id: thread.id,
    title: thread.title,
    lastActivityAt: thread.lastActivityAt,
    createdAt: thread.createdAt,
    runtime: {
      status: runtimeState.status,
      lastError: runtimeState.lastError,
    },
  };
}

export async function buildShellCatalog({
  repositories,
  selection,
  repositoryPreferences = [],
  workspaceSessions = [],
  inspectRepository,
  listThreadsByWorktree,
  getRuntimeState,
  selectedAgentSnapshot,
}: BuildShellCatalogOptions): Promise<ShellCatalogSnapshot> {
  const repositorySnapshots = await Promise.all(
    repositories.map(async (repository) => {
      const preferences =
        repositoryPreferences.find(
          (entry) => entry.repositoryId === repository.id,
        ) ?? null;
      const inspection = await inspectRepository(repository.rootPath);
      const fallbackName =
        preferences?.customName ??
        repository.label ??
        path.basename(repository.rootPath);

      if (
        inspection.status !== "repository" ||
        !inspection.rootPath ||
        !inspection.worktrees
      ) {
        const folderThreads = await Promise.all(
          listThreadsByWorktree(repository.rootPath).map((thread) =>
            createThreadSnapshot(
              thread,
              repository.rootPath,
              getRuntimeState,
              selection.threadId,
              selectedAgentSnapshot,
            ),
          ),
        );

        const folderCreatedAt = folderThreads.reduce<number | undefined>(
          (oldest, t) =>
            t.createdAt != null
              ? oldest == null
                ? t.createdAt
                : Math.min(oldest, t.createdAt)
              : oldest,
          undefined,
        );

        return {
          id: repository.id,
          order: repository.order,
          name: fallbackName,
          customName: preferences?.customName ?? null,
          icon: preferences?.icon ?? null,
          accentColor: preferences?.accentColor ?? null,
          rootPath: repository.rootPath,
          defaultBranch: null,
          worktrees: [
            createFolderWorkspaceSnapshot({
              rootPath: repository.rootPath,
              fallbackName,
              threads: folderThreads,
              createdAt: folderCreatedAt,
            }),
          ],
        };
      }

      const appWorktrees = inspection.worktrees.filter(
        (worktree) =>
          worktree.isMain ||
          worktree.isCurrent ||
          isPiDesktopWorktree(worktree.path),
      );

      const worktrees = await Promise.all(
        appWorktrees.map(async (worktree) => {
          const threads = await Promise.all(
            listThreadsByWorktree(worktree.path).map((thread) =>
              createThreadSnapshot(
                thread,
                worktree.path,
                getRuntimeState,
                selection.threadId,
                selectedAgentSnapshot,
              ),
            ),
          );

          const createdAt = threads.reduce<number | undefined>(
            (oldest, t) =>
              t.createdAt != null
                ? oldest == null
                  ? t.createdAt
                  : Math.min(oldest, t.createdAt)
                : oldest,
            undefined,
          );

          return {
            id: worktree.path,
            label: createWorktreeLabel(worktree, fallbackName),
            path: worktree.path,
            isMain: worktree.isMain,
            isDetached: worktree.isDetached,
            git: worktree.git,
            threads,
            createdAt,
          };
        }),
      );

      return {
        id: repository.id,
        order: repository.order,
        name: fallbackName,
        customName: preferences?.customName ?? null,
        icon: preferences?.icon ?? null,
        accentColor: preferences?.accentColor ?? null,
        rootPath: repository.rootPath,
        defaultBranch: inspection.defaultBranch ?? null,
        worktrees,
      };
    }),
  );

  return {
    repositories: repositorySnapshots,
    selection: reconcileSelection(repositorySnapshots, selection),
    reconciledWorkspaceSessions: reconcileWorkspaceSessions({
      repositories: repositorySnapshots,
      workspaceSessions,
    }),
  };
}
