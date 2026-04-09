import { IPC_CHANNELS } from "@pidesk/shared";
import type { RegisterIpcHandlersDependencies } from "../ipc-router";
import { getStringField } from "./payload-parsers";

type RegisterRepositoryHandlersDependencies = Pick<
  RegisterIpcHandlersDependencies,
  "handle" | "agentHost"
>;

function getStringArrayField(payload: unknown, key: string): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const value = (payload as Record<string, unknown>)[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

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

  handle(IPC_CHANNELS.repositories.reorder, async (_event, payload) => {
    const repositoryIds = getStringArrayField(payload, "repositoryIds");
    if (repositoryIds.length === 0) {
      throw new Error("Repository reorder payload must include repositoryIds");
    }

    await agentHost.reorderRepositories(repositoryIds);
  });

  handle(IPC_CHANNELS.repositories.remove, async (_event, payload) => {
    const repositoryId = getStringField(payload, "repositoryId");
    if (!repositoryId) {
      throw new Error("Repository remove payload must include repositoryId");
    }

    await agentHost.removeRepository(repositoryId);
  });

  handle(IPC_CHANNELS.repositories.openInFinder, async (_event, payload) => {
    const repositoryId = getStringField(payload, "repositoryId");
    if (!repositoryId) {
      throw new Error(
        "Repository openInFinder payload must include repositoryId",
      );
    }

    await agentHost.openRepositoryInFinder(repositoryId);
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
