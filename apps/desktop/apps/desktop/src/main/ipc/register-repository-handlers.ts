import { IPC_CHANNELS } from "@pidesk/shared";

export function registerRepositoryHandlers({
  handle,
  agentHost,
}: {
  handle: (
    channel: string,
    listener: (
      event?: unknown,
      payload?: unknown,
    ) => Promise<unknown> | unknown,
  ) => void;
  agentHost: any;
}) {
  handle(IPC_CHANNELS.repositories.add, async (_event, payload) => {
    const repositoryPath = (payload as any)?.path as string | undefined;
    if (!repositoryPath) {
      throw new Error("Repository add payload must include path");
    }
    await agentHost.addRepository(repositoryPath);
  });

  handle(IPC_CHANNELS.repositories.select, async (_event, payload) => {
    const repositoryId = (payload as any)?.repositoryId as string | undefined;
    if (!repositoryId) {
      throw new Error("Repository select payload must include repositoryId");
    }
    await agentHost.selectRepository(repositoryId);
  });

  handle(IPC_CHANNELS.worktrees.create, async (_event, payload) => {
    const repositoryId = (payload as any)?.repositoryId as string | undefined;
    const branchName = (payload as any)?.branchName as string | undefined;
    if (!repositoryId || !branchName) {
      throw new Error(
        "Worktree create payload must include repositoryId and branchName",
      );
    }
    await agentHost.createWorktree(repositoryId, branchName);
  });

  handle(IPC_CHANNELS.worktrees.select, async (_event, payload) => {
    const worktreeId = (payload as any)?.worktreeId as string | undefined;
    if (!worktreeId) {
      throw new Error("Worktree select payload must include worktreeId");
    }
    await agentHost.selectWorktree(worktreeId);
  });
}

export default undefined;
