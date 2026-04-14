import { IPC_CHANNELS } from "@pi-desktop/shared";
import type { RegisterIpcHandlersDependencies } from "../ipc-router";
import { getStringField } from "./payload-parsers";

type RegisterThreadHandlersDependencies = Pick<
  RegisterIpcHandlersDependencies,
  "handle" | "agentHost"
>;

export function registerThreadHandlers({
  handle,
  agentHost,
}: RegisterThreadHandlersDependencies): void {
  handle(IPC_CHANNELS.threads.create, async (_event, payload) => {
    const worktreeId = getStringField(payload, "worktreeId");
    if (!worktreeId) {
      throw new Error("Thread create payload must include worktreeId");
    }

    return agentHost.createThread(worktreeId);
  });

  handle(IPC_CHANNELS.threads.select, async (_event, payload) => {
    const threadId = getStringField(payload, "threadId");
    if (!threadId) {
      throw new Error("Thread select payload must include threadId");
    }

    await agentHost.selectThread(threadId);
  });

  handle(IPC_CHANNELS.threads.archive, async (_event, payload) => {
    const threadId = getStringField(payload, "threadId");
    if (!threadId) {
      throw new Error("Thread archive payload must include threadId");
    }

    await agentHost.archiveThread(threadId);
  });

  handle(IPC_CHANNELS.threads.delete, async (_event, payload) => {
    const threadId = getStringField(payload, "threadId");
    if (!threadId) {
      throw new Error("Thread delete payload must include threadId");
    }

    await agentHost.deleteThread(threadId);
  });
}
