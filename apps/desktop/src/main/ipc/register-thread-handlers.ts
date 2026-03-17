import { IPC_CHANNELS, type PiTerminalRouteResult } from "@pidesk/shared";
import type { RegisterIpcHandlersDependencies } from "../ipc-router";
import { getBooleanField, getStringField } from "./payload-parsers";

type RegisterThreadHandlersDependencies = Pick<
  RegisterIpcHandlersDependencies,
  "handle" | "agentHost" | "routeToTerminal"
>;

export function registerThreadHandlers({
  handle,
  agentHost,
  routeToTerminal,
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

  handle(IPC_CHANNELS.threads.routeToTerminal, async (_event, payload) => {
    if (!routeToTerminal) {
      return {
        success: false,
        error: "Terminal routing is unavailable",
      } satisfies PiTerminalRouteResult;
    }

    const terminalId = getStringField(payload, "terminalId");
    const prompt = getStringField(payload, "prompt");
    const startPiIfNotLinked =
      getBooleanField(payload, "startPiIfNotLinked") ?? false;
    if (!terminalId || prompt === undefined) {
      throw new Error(
        "Terminal routing payload must include terminalId and prompt",
      );
    }

    return routeToTerminal({ terminalId, prompt, startPiIfNotLinked });
  });
}
