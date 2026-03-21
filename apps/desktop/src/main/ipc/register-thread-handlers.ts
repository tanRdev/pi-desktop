import { IPC_CHANNELS } from "@pidesk/shared";
import type { RegisterIpcHandlersDependencies } from "../ipc-router";
import { getStringField } from "./payload-parsers";

type RegisterThreadHandlersDependencies = Pick<
  RegisterIpcHandlersDependencies,
  "handle" | "agentHost" | "threadCatalog"
>;

export function registerThreadHandlers({
  handle,
  agentHost,
  threadCatalog,
}: RegisterThreadHandlersDependencies): void {
  handle(IPC_CHANNELS.threads.create, async (_event, payload) => {
    const worktreeId = getStringField(payload, "worktreeId");
    const title = getStringField(payload, "title");
    if (!worktreeId) {
      throw new Error("Thread create payload must include worktreeId");
    }

    await agentHost.createThread(worktreeId, title);
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
    if (!threadCatalog) {
      throw new Error("Thread catalog is not available");
    }

    threadCatalog.archive(threadId);
  });

  handle(IPC_CHANNELS.threads.rename, async (_event, payload) => {
    const threadId = getStringField(payload, "threadId");
    const title = getStringField(payload, "title");
    if (!threadId || !title) {
      throw new Error("Thread rename payload must include threadId and title");
    }
    if (!threadCatalog) {
      throw new Error("Thread catalog is not available");
    }

    threadCatalog.rename(threadId, title);
  });
}
