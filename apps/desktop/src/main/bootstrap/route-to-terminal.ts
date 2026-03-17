import type {
  PiTerminalRouteRequest,
  PiTerminalRouteResult,
  TerminalBackend,
} from "@pidesk/shared";

type TerminalSessionLike = {
  id: string;
  backend: TerminalBackend;
  linkedThreadId?: string;
};

type RoutePromptToTerminalDeps = {
  terminalManager: {
    getSessions(): TerminalSessionLike[];
    write(id: string, data: string): void;
  };
  delay(ms: number): Promise<void>;
};

export async function routePromptToTerminal(
  request: PiTerminalRouteRequest,
  deps: RoutePromptToTerminalDeps,
): Promise<PiTerminalRouteResult> {
  const prompt = request.prompt.trim();
  if (!prompt) {
    return { success: false, error: "Prompt must not be empty" };
  }

  const session = deps.terminalManager
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
    deps.terminalManager.write(session.id, "pi\n");
    await deps.delay(150);
  }

  deps.terminalManager.write(session.id, `${prompt}\n`);

  return {
    success: true,
    threadId: session.linkedThreadId,
  };
}
