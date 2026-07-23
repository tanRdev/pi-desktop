import {
  registerContractHandler,
  repositoryContracts,
  worktreeContracts,
} from "@pi-desktop/contracts";
import type { RegisterIpcHandlersDependencies } from "../ipc-router";

type RegisterRepositoryHandlersDependencies = Pick<
  RegisterIpcHandlersDependencies,
  "handle" | "agentHost"
>;

export function registerRepositoryHandlers({
  handle,
  agentHost,
}: RegisterRepositoryHandlersDependencies): void {
  registerContractHandler({
    handle,
    contract: repositoryContracts.add,
    handler: async ({ path }) => {
      await agentHost.addRepository(path);
    },
  });

  registerContractHandler({
    handle,
    contract: repositoryContracts.select,
    handler: async ({ repositoryId }) => {
      await agentHost.selectRepository(repositoryId);
    },
  });

  registerContractHandler({
    handle,
    contract: repositoryContracts.reorder,
    handler: async ({ repositoryIds }) => {
      await agentHost.reorderRepositories([...repositoryIds]);
    },
  });

  registerContractHandler({
    handle,
    contract: repositoryContracts.remove,
    handler: async ({ repositoryId }) => {
      await agentHost.removeRepository(repositoryId);
    },
  });

  registerContractHandler({
    handle,
    contract: repositoryContracts.openInFinder,
    handler: async ({ repositoryId }) => {
      await agentHost.openRepositoryInFinder(repositoryId);
    },
  });

  registerContractHandler({
    handle,
    contract: worktreeContracts.create,
    handler: async ({ repositoryId, branchName }) => {
      await agentHost.createWorktree(repositoryId, branchName);
    },
  });

  registerContractHandler({
    handle,
    contract: worktreeContracts.select,
    handler: async ({ worktreeId }) => {
      await agentHost.selectWorktree(worktreeId);
    },
  });

  registerContractHandler({
    handle,
    contract: worktreeContracts.remove,
    handler: async ({ worktreeId }) => {
      await agentHost.removeWorktree(worktreeId);
    },
  });
}
