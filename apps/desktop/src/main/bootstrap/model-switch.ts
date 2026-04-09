import type { ModelSwitchRequest } from "@pidesk/shared";

type SwitchModelContext = {
  worktreePath: string;
  thread: { id: string };
  command: string[];
};

type SettingsManagerLike = {
  setDefaultProvider(providerId: string): void | Promise<void>;
  setDefaultModel(modelId: string): void | Promise<void>;
};

type SwitchModelDeps = {
  currentContext: SwitchModelContext | null;
  resolveAgentDirectory(): string;
  createSettingsManager(
    worktreePath: string,
    agentDirectory: string,
  ): SettingsManagerLike | Promise<SettingsManagerLike>;
  runtimeManager: {
    restartThreadRuntime(input: {
      threadId: string;
      worktreePath: string;
      command: string[];
    }): Promise<unknown>;
  };
  attachContext(context: SwitchModelContext): Promise<unknown>;
  commitAttachment(attached: unknown): void | Promise<void>;
};

export async function switchModelForContext(
  request: ModelSwitchRequest,
  deps: SwitchModelDeps,
): Promise<void> {
  if (!deps.currentContext) {
    throw new Error("No active Pi context is selected");
  }

  const currentContext = deps.currentContext;
  const agentDirectory = deps.resolveAgentDirectory();
  const settingsManager = await deps.createSettingsManager(
    currentContext.worktreePath,
    agentDirectory,
  );

  await settingsManager.setDefaultProvider(request.providerId);
  await settingsManager.setDefaultModel(request.modelId);

  if (currentContext.command.length === 0) {
    return;
  }

  await deps.runtimeManager.restartThreadRuntime({
    threadId: currentContext.thread.id,
    worktreePath: currentContext.worktreePath,
    command: currentContext.command,
  });

  const attached = await deps.attachContext(currentContext);
  await deps.commitAttachment(attached);
}
