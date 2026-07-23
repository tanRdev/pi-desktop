import {
  registerContractHandler,
  threadContracts,
} from "@pi-desktop/contracts";
import type { RegisterIpcHandlersDependencies } from "../ipc-router";

type RegisterThreadHandlersDependencies = Pick<
  RegisterIpcHandlersDependencies,
  "handle" | "agentHost"
>;

export function registerThreadHandlers({
  handle,
  agentHost,
}: RegisterThreadHandlersDependencies): void {
  registerContractHandler({
    handle,
    contract: threadContracts.create,
    handler: ({ worktreeId }) => agentHost.createThread(worktreeId),
  });

  registerContractHandler({
    handle,
    contract: threadContracts.select,
    handler: async ({ threadId }) => {
      await agentHost.selectThread(threadId);
    },
  });

  registerContractHandler({
    handle,
    contract: threadContracts.delete,
    handler: async ({ threadId }) => {
      await agentHost.deleteThread(threadId);
    },
  });
}
