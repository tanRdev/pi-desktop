import path from "node:path";
import type { AgentSnapshot, ShellCatalogSnapshot, ThreadSnapshot } from "@pidesk/shared";
import type { GitRepositoryInspection, GitWorktreeSummary } from "./git-worktree-service";
import type { RepositoryCatalogEntry } from "./repository-catalog";
import type { AppSelectionState } from "./selection-state";
import type { ThreadCatalogEntry } from "./thread-catalog";
import type { ThreadRuntimeRef } from "./thread-runtime-manager";

export interface BuildShellCatalogOptions {
  repositories: RepositoryCatalogEntry[];
  selection: AppSelectionState;
  inspectRepository: (rootPath: string) => GitRepositoryInspection;
  listThreadsByWorktree: (worktreeId: string) => ThreadCatalogEntry[];
  getRuntimeState: (thread: ThreadRuntimeRef) => Promise<{
    status: ThreadSnapshot["runtime"]["status"];
    lastError: string | null;
  }>;
  selectedAgentSnapshot?: AgentSnapshot | null;
}

function createWorktreeLabel(worktree: GitWorktreeSummary, fallbackName: string): string {
  if (worktree.branch) {
    return worktree.branch;
  }

  if (worktree.isDetached) {
    return `Detached ${worktree.commit ?? ""}`.trim();
  }

  return path.basename(worktree.path) || fallbackName;
}

function reconcileSelection(
  repositories: ShellCatalogSnapshot["repositories"],
  selection: AppSelectionState,
): AppSelectionState {
  const repository =
    repositories.find((item) => item.id === selection.repositoryId) ??
    repositories[0] ??
    null;
  const worktree =
    repository?.worktrees.find((item) => item.id === selection.worktreeId) ??
    repository?.worktrees[0] ??
    null;
  const thread =
    worktree?.threads.find((item) => item.id === selection.threadId) ??
    worktree?.threads.find((item) => item.isArchived === false) ??
    worktree?.threads[0] ??
    null;

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
    isArchived: thread.archivedAt !== null,
    lastActivityAt: thread.lastActivityAt,
    runtime: {
      status: runtimeState.status,
      lastError: runtimeState.lastError,
    },
  };
}

export async function buildShellCatalog({
  repositories,
  selection,
  inspectRepository,
  listThreadsByWorktree,
  getRuntimeState,
  selectedAgentSnapshot,
}: BuildShellCatalogOptions): Promise<ShellCatalogSnapshot> {
  const repositorySnapshots = await Promise.all(
    repositories.map(async (repository) => {
      const inspection = inspectRepository(repository.rootPath);
      const fallbackName = repository.label ?? path.basename(repository.rootPath);

      if (
        inspection.status !== "repository" ||
        !inspection.rootPath ||
        !inspection.worktrees
      ) {
        return {
          id: repository.id,
          name: fallbackName,
          rootPath: repository.rootPath,
          defaultBranch: null,
          worktrees: [],
        };
      }

      const worktrees = await Promise.all(
        inspection.worktrees.map(async (worktree) => ({
          id: worktree.path,
          label: createWorktreeLabel(worktree, fallbackName),
          path: worktree.path,
          isMain: worktree.isMain,
          isDetached: worktree.isDetached,
          git: worktree.git,
          threads: await Promise.all(
            listThreadsByWorktree(worktree.path).map((thread) =>
              createThreadSnapshot(
                thread,
                worktree.path,
                getRuntimeState,
                selection.threadId,
                selectedAgentSnapshot,
              ),
            ),
          ),
        })),
      );

      return {
        id: repository.id,
        name: fallbackName,
        rootPath: repository.rootPath,
        defaultBranch: inspection.defaultBranch ?? null,
        worktrees,
      };
    }),
  );

  return {
    repositories: repositorySnapshots,
    selection: reconcileSelection(repositorySnapshots, selection),
  };
}
