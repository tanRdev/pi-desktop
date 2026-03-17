import type { ModelSwitchRequest } from "@pidesk/shared";

export async function switchModelForContext(
  request: ModelSwitchRequest,
  deps: {
    currentContext: {
      worktreePath: string;
      thread: { id: string };
      command: string[];
      agentDirectory: string | null;
    } | null;
    resolveAgentDirectory: () => string;
    createSettingsManager: (
      worktreePath: string,
      agentDirectory: string | null,
    ) => Promise<{
      setDefaultProvider(providerId: string): void;
      setDefaultModel(modelId: string): void;
    }>;
    restartThreadRuntime: (args: {
      threadId: string;
      worktreePath: string;
      command: string[];
    }) => Promise<void>;
    attachContext: (ctx: any) => Promise<any>;
    commitAttachment: (a: any) => void;
  },
): Promise<void> {
  if (!deps.currentContext) {
    throw new Error("No active Pi context is selected");
  }

  const agentDirectory = deps.resolveAgentDirectory();
  const settingsManager = await deps.createSettingsManager(
    deps.currentContext.worktreePath,
    agentDirectory,
  );
  settingsManager.setDefaultProvider(request.providerId);
  settingsManager.setDefaultModel(request.modelId);

  await deps.restartThreadRuntime({
    threadId: deps.currentContext.thread.id,
    worktreePath: deps.currentContext.worktreePath,
    command: deps.currentContext.command,
  });

  const attached = await deps.attachContext(deps.currentContext);
  deps.commitAttachment(attached);
}
