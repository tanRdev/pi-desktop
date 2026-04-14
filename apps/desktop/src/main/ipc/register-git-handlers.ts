import { IPC_CHANNELS } from "@pi-desktop/shared";
import type { GitWorktreeService } from "../git-worktree-service";
import type { IpcRegistrar } from "../ipc-router";
import { getStringField } from "./payload-parsers";

interface RegisterGitHandlersDependencies {
  handle: IpcRegistrar["handle"];
  gitService: GitWorktreeService;
}

function requireRepositoryPath(payload: unknown): string {
  const repositoryPath = getStringField(payload, "repositoryPath");
  if (!repositoryPath) {
    throw new Error("Git payload must include repositoryPath");
  }

  return repositoryPath;
}

function requireFilePath(payload: unknown): string {
  const filePath = getStringField(payload, "filePath");
  if (!filePath) {
    throw new Error("Git payload must include filePath");
  }

  return filePath;
}

export function registerGitHandlers({
  handle,
  gitService,
}: RegisterGitHandlersDependencies): void {
  handle(IPC_CHANNELS.git.getRepositoryStatus, async (_event, payload) =>
    gitService.getRepositoryStatus(requireRepositoryPath(payload)),
  );

  handle(IPC_CHANNELS.git.isRepository, async (_event, payload) =>
    gitService.isRepository(requireRepositoryPath(payload)),
  );

  handle(IPC_CHANNELS.git.init, async (_event, payload) => {
    gitService.init(requireRepositoryPath(payload));
  });

  handle(IPC_CHANNELS.git.stageFile, async (_event, payload) =>
    gitService.stageFile(
      requireRepositoryPath(payload),
      requireFilePath(payload),
    ),
  );

  handle(IPC_CHANNELS.git.unstageFile, async (_event, payload) =>
    gitService.unstageFile(
      requireRepositoryPath(payload),
      requireFilePath(payload),
    ),
  );

  handle(IPC_CHANNELS.git.discardFile, async (_event, payload) =>
    gitService.discardFile(
      requireRepositoryPath(payload),
      requireFilePath(payload),
    ),
  );

  handle(IPC_CHANNELS.git.commit, async (_event, payload) => {
    const repositoryPath = requireRepositoryPath(payload);
    const message = getStringField(payload, "message");
    if (!message) {
      throw new Error("Git commit payload must include message");
    }

    return gitService.commit(repositoryPath, message);
  });

  handle(IPC_CHANNELS.git.pull, async (_event, payload) =>
    gitService.pull(requireRepositoryPath(payload)),
  );

  handle(IPC_CHANNELS.git.push, async (_event, payload) =>
    gitService.push(requireRepositoryPath(payload)),
  );
}
