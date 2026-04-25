type ThreadLike = {
  id: string;
  worktreeId: string;
};

type DeleteThreadAndRefreshDeps<TThread extends ThreadLike, TContext> = {
  getThread(threadId: string): TThread | undefined;
  deleteThread(threadId: string): void;
  listByWorktree(worktreeId: string): TThread[];
  getActiveThreadId(): string | null;
  getSelectedRepositoryId(): string | null;
  notifySessionChanged(): void;
  selectWorktreeWithoutThread(
    repositoryId: string | null,
    worktreePath: string,
  ): void;
  resolveThreadContext(threadId: string): Promise<TContext>;
  switchContextInBackground(context: TContext): void;
};

export async function deleteThreadAndRefresh<
  TThread extends ThreadLike,
  TContext,
>(
  threadId: string,
  deps: DeleteThreadAndRefreshDeps<TThread, TContext>,
): Promise<void> {
  const thread = deps.getThread(threadId);
  if (!thread) {
    throw new Error(`Unknown thread: ${threadId}`);
  }

  const isActiveThread = deps.getActiveThreadId() === threadId;

  deps.deleteThread(threadId);

  if (!isActiveThread) {
    deps.notifySessionChanged();
    return;
  }

  const nextOpenThread = deps
    .listByWorktree(thread.worktreeId)
    .find((entry) => entry.id !== threadId);

  if (!nextOpenThread) {
    deps.selectWorktreeWithoutThread(
      deps.getSelectedRepositoryId(),
      thread.worktreeId,
    );
    return;
  }

  const context = await deps.resolveThreadContext(nextOpenThread.id);
  deps.switchContextInBackground(context);
}
