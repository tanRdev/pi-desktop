import { IPC_CHANNELS } from "@pidesk/shared";
import type { RegisterIpcHandlersDependencies } from "../ipc-router";
import { getStringField } from "./payload-parsers";

type RegisterRepositoryHandlersDependencies = Pick<
  RegisterIpcHandlersDependencies,
  "handle" | "agentHost"
>;

export function registerRepositoryHandlers({
  handle,
  agentHost,
}: RegisterRepositoryHandlersDependencies): void {
  handle(IPC_CHANNELS.repositories.add, async (_event, payload) => {
    const repositoryPath = getStringField(payload, "path");
    if (!repositoryPath) {
      throw new Error("Repository add payload must include path");
    }

    await agentHost.addRepository(repositoryPath);
  });

  handle(IPC_CHANNELS.repositories.select, async (_event, payload) => {
    const repositoryId = getStringField(payload, "repositoryId");
    if (!repositoryId) {
      throw new Error("Repository select payload must include repositoryId");
    }

    await agentHost.selectRepository(repositoryId);
  });

  handle(IPC_CHANNELS.worktrees.create, async (_event, payload) => {
    const repositoryId = getStringField(payload, "repositoryId");
    const branchName = getStringField(payload, "branchName");
    if (!repositoryId || !branchName) {
      throw new Error(
        "Worktree create payload must include repositoryId and branchName",
      );
    }

    await agentHost.createWorktree(repositoryId, branchName);
  });

  handle(IPC_CHANNELS.worktrees.select, async (_event, payload) => {
    const worktreeId = getStringField(payload, "worktreeId");
    if (!worktreeId) {
      throw new Error("Worktree select payload must include worktreeId");
    }

    await agentHost.selectWorktree(worktreeId);
  });
}
