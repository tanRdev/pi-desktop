import { realpathSync as realpathSyncDefault } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { IPC_CHANNELS } from "@pi-desktop/shared";
import type { GitWorktreeService } from "../git-worktree-service";
import type { IpcRegistrar } from "../ipc-router";
import { getStringArrayField, getStringField } from "./payload-parsers";

interface RegisterGitHandlersDependencies {
  handle: IpcRegistrar["handle"];
  gitService: GitWorktreeService;
  getAllowedRepositoryRoots: () => readonly string[];
}

function canonicalize(targetPath: string): string {
  try {
    const realpathSync = realpathSyncDefault.native ?? realpathSyncDefault;
    return realpathSync(targetPath);
  } catch {
    return targetPath;
  }
}

function isPathInside(child: string, parent: string): boolean {
  if (child === parent) {
    return true;
  }
  const rel = relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function requireAllowedRepositoryPath(
  payload: unknown,
  getAllowedRepositoryRoots: () => readonly string[],
): string {
  const repositoryPath = getStringField(payload, "repositoryPath");
  if (!repositoryPath) {
    throw new Error("Git payload must include repositoryPath");
  }

  const allowedRoots = getAllowedRepositoryRoots();
  if (allowedRoots.length === 0) {
    throw new Error(
      `repositoryPath is not an allowed repository: ${repositoryPath}`,
    );
  }

  const resolvedTarget = resolve(repositoryPath);
  const canonicalTarget = canonicalize(resolvedTarget);

  for (const root of allowedRoots) {
    const resolvedRoot = resolve(root);
    const canonicalRoot = canonicalize(resolvedRoot);
    if (
      isPathInside(resolvedTarget, resolvedRoot) ||
      isPathInside(canonicalTarget, canonicalRoot)
    ) {
      return repositoryPath;
    }
  }

  throw new Error(
    `repositoryPath is not an allowed repository: ${repositoryPath}`,
  );
}

function requireFilePath(payload: unknown): string {
  const filePath = getStringField(payload, "filePath");
  if (!filePath) {
    throw new Error("Git payload must include filePath");
  }

  return filePath;
}

function requireFilePaths(payload: unknown): string[] {
  const filePaths = getStringArrayField(payload, "filePaths");
  if (!filePaths || filePaths.length === 0) {
    throw new Error("Git payload must include filePaths");
  }

  return filePaths;
}

export function registerGitHandlers({
  handle,
  gitService,
  getAllowedRepositoryRoots,
}: RegisterGitHandlersDependencies): void {
  handle(IPC_CHANNELS.git.getRepositoryStatus, async (_event, payload) =>
    gitService.getRepositoryStatus(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
    ),
  );

  handle(IPC_CHANNELS.git.isRepository, async (_event, payload) =>
    gitService.isRepository(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
    ),
  );

  handle(IPC_CHANNELS.git.init, async (_event, payload) => {
    gitService.init(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
    );
  });

  handle(IPC_CHANNELS.git.stageFile, async (_event, payload) =>
    gitService.stageFile(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
      requireFilePath(payload),
    ),
  );

  handle(IPC_CHANNELS.git.stageFiles, async (_event, payload) =>
    gitService.stageFiles(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
      requireFilePaths(payload),
    ),
  );

  handle(IPC_CHANNELS.git.unstageFile, async (_event, payload) =>
    gitService.unstageFile(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
      requireFilePath(payload),
    ),
  );

  handle(IPC_CHANNELS.git.unstageFiles, async (_event, payload) =>
    gitService.unstageFiles(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
      requireFilePaths(payload),
    ),
  );

  handle(IPC_CHANNELS.git.discardFile, async (_event, payload) =>
    gitService.discardFile(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
      requireFilePath(payload),
    ),
  );

  handle(IPC_CHANNELS.git.commit, async (_event, payload) => {
    const repositoryPath = requireAllowedRepositoryPath(
      payload,
      getAllowedRepositoryRoots,
    );
    const message = getStringField(payload, "message");
    if (!message) {
      throw new Error("Git commit payload must include message");
    }

    return gitService.commit(repositoryPath, message);
  });

  handle(IPC_CHANNELS.git.pull, async (_event, payload) =>
    gitService.pull(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
    ),
  );

  handle(IPC_CHANNELS.git.push, async (_event, payload) =>
    gitService.push(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
    ),
  );
}
