import path from "node:path";
import type { ThreadCatalogEntry } from "../thread-catalog";
import type {
  ResolvedRepositoryInspection,
  SelectedThreadContext,
} from "./thread-context";

type ThreadLike = Pick<ThreadCatalogEntry, "id" | "worktreeId">;

type CreateThreadWorkspaceActionsDependencies<
  TThread extends ThreadLike = ThreadCatalogEntry,
  TContext extends
    SelectedThreadContext<TThread> = SelectedThreadContext<TThread>,
> = {
  getCurrentWorktreeId(): string | null;
  getRepositoryIdForWorktree(worktreeId: string): string | null;
  upsertRepository(input: { rootPath: string }): { id: string };
  getDefaultThreadTitle(): string;
  createThread(input: { worktreeId: string; title: string }): TThread;
  getThread(threadId: string): TThread | null;
  inspectWorktreeOrThrow(worktreeId: string): ResolvedRepositoryInspection;
  buildThreadContext(
    repositoryId: string,
    inspection: ResolvedRepositoryInspection,
    thread: TThread,
  ): TContext;
  buildFastThreadContext(input: {
    repositoryId: string;
    worktreePath: string;
    thread: TThread;
  }): TContext;
  switchContextInBackground(context: TContext): void;
};

function normalizeWorktreeId(worktreeId: string): string {
  const resolved = path.resolve(worktreeId);
  return resolved.replace(/[\\/]+$/, "") || resolved;
}

export function createThreadWorkspaceActions<
  TThread extends ThreadLike = ThreadCatalogEntry,
  TContext extends
    SelectedThreadContext<TThread> = SelectedThreadContext<TThread>,
>(deps: CreateThreadWorkspaceActionsDependencies<TThread, TContext>) {
  function resolveRepositoryId(worktreeId: string): string {
    return (
      deps.getRepositoryIdForWorktree(worktreeId) ??
      deps.upsertRepository({ rootPath: worktreeId }).id
    );
  }

  function buildContextForThread(
    worktreeId: string,
    thread: TThread,
  ): TContext {
    if (worktreeId === deps.getCurrentWorktreeId()) {
      return deps.buildFastThreadContext({
        repositoryId: resolveRepositoryId(worktreeId),
        worktreePath: worktreeId,
        thread,
      });
    }

    const inspection = deps.inspectWorktreeOrThrow(worktreeId);
    const repositoryId = deps.upsertRepository({
      rootPath: inspection.rootPath,
    }).id;

    return deps.buildThreadContext(repositoryId, inspection, thread);
  }

  async function createThread(worktreeId: string): Promise<string> {
    const normalizedWorktreeId = normalizeWorktreeId(worktreeId);
    const thread = deps.createThread({
      worktreeId: normalizedWorktreeId,
      title: deps.getDefaultThreadTitle(),
    });
    const context = buildContextForThread(normalizedWorktreeId, thread);

    deps.switchContextInBackground(context);

    return context.thread.id;
  }

  async function selectThread(threadId: string): Promise<void> {
    const thread = deps.getThread(threadId);
    if (!thread) {
      throw new Error(`Unknown thread: ${threadId}`);
    }

    const context = buildContextForThread(thread.worktreeId, thread);
    deps.switchContextInBackground(context);
  }

  return {
    createThread,
    selectThread,
  };
}
