import type {
  PiTerminalRouteRequest,
  PiTerminalRouteResult,
} from "@pidesk/shared";

export async function routePromptToTerminal(
  request: PiTerminalRouteRequest,
  deps: {
    getSessions: () => Array<{
      id: string;
      backend?: string;
      linkedThreadId?: string | null;
    }>;
    write: (id: string, data: string) => void;
    delay: (ms: number) => Promise<void>;
  },
): Promise<PiTerminalRouteResult> {
  const prompt = (request.prompt ?? "").trim();
  if (!prompt) {
    return { success: false, error: "Prompt must not be empty" };
  }

  const session = deps
    .getSessions()
    .find((candidate) => candidate.id === request.terminalId);
  if (!session) {
    return {
      success: false,
      error: `Unknown terminal session: ${request.terminalId}`,
    };
  }

  if (session.backend === "lazygit") {
    return {
      success: false,
      error: "Cannot route prompts into a lazygit session",
    };
  }

  if (request.startPiIfNotLinked && !session.linkedThreadId) {
    deps.write(session.id, "pi\n");
    await deps.delay(150);
  }

  deps.write(session.id, `${prompt}\n`);
  return { success: true, threadId: session.linkedThreadId ?? undefined };
}
