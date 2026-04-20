import { IPC_CHANNELS } from "@pi-desktop/shared";
import { resolveInsideRoot } from "../fs/path-guards";
import type { GitWorktreeService } from "../git-worktree-service";
import type { IpcRegistrar } from "../ipc-router";
import {
  getStringArrayField,
  MAX_STRING_BYTES,
  PayloadValidationError,
  requireStringField,
} from "./payload-parsers";

/**
 * Maximum size of a git commit message. 100 KB is generous but rules out
 * DOS-by-payload (kernel.org's longest known commit message is ~50 KB).
 */
const MAX_COMMIT_MESSAGE_BYTES = 100 * 1024;

interface RegisterGitHandlersDependencies {
  handle: IpcRegistrar["handle"];
  gitService: GitWorktreeService;
  getAllowedRepositoryRoots: () => readonly string[];
}

function requireValidPath(payload: unknown): string {
  const path = requireStringField(payload, "repositoryPath");
  // Reject null bytes and normalize but do NOT restrict to allowed roots.
  // This is for read-only checks like isRepository that need to validate
  // arbitrary paths before they are added to the catalog.
  if (path.includes("\0")) {
    throw new PayloadValidationError(
      "payload/null-byte",
      "path must not contain null bytes",
      "repositoryPath",
    );
  }
  return path;
}

function requireAllowedRepositoryPath(
  payload: unknown,
  getAllowedRepositoryRoots: () => readonly string[],
): string {
  const repositoryPath = requireStringField(payload, "repositoryPath");
  const allowedRoots = getAllowedRepositoryRoots();
  // `resolveInsideRoot` enforces: null-byte rejection, lexical `..` traversal
  // rejection, and symlink-escape rejection. The returned path is the
  // canonical on-disk location (already realpath'd).
  return resolveInsideRoot(allowedRoots, repositoryPath);
}

function requireFilePath(payload: unknown): string {
  return requireStringField(payload, "filePath");
}

function requireFilePaths(payload: unknown): string[] {
  const filePaths = getStringArrayField(payload, "filePaths");
  if (!filePaths || filePaths.length === 0) {
    throw new PayloadValidationError(
      "payload/empty-array",
      'field "filePaths" must be a non-empty array of strings',
      "filePaths",
    );
  }
  return filePaths;
}

function requireStaged(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const staged = Reflect.get(payload, "staged");
  return typeof staged === "boolean" ? staged : false;
}

function requireForce(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const force = Reflect.get(payload, "force");
  return typeof force === "boolean" ? force : false;
}

export function registerGitHandlers({
  handle,
  gitService,
  getAllowedRepositoryRoots,
}: RegisterGitHandlersDependencies): void {
  handle(IPC_CHANNELS.git.getRepositoryStatus, async (_event, payload) =>
    gitService.getRepositoryStatus(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
      { force: requireForce(payload) },
    ),
  );

  // isRepository and init are called before a path is added to the catalog,
  // so they must accept any absolute path. Mutation handlers for existing
  // repositories still use allowed roots.
  handle(IPC_CHANNELS.git.isRepository, async (_event, payload) =>
    gitService.isRepository(requireValidPath(payload)),
  );

  handle(IPC_CHANNELS.git.init, async (_event, payload) => {
    gitService.init(requireValidPath(payload));
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
    const message = requireStringField(payload, "message");
    if (Buffer.byteLength(message, "utf-8") > MAX_COMMIT_MESSAGE_BYTES) {
      throw new PayloadValidationError(
        "payload/string-too-large",
        `commit message exceeds maximum size of ${MAX_COMMIT_MESSAGE_BYTES} bytes`,
        "message",
      );
    }
    // Defense in depth: the global per-string cap also applies.
    if (Buffer.byteLength(message, "utf-8") > MAX_STRING_BYTES) {
      throw new PayloadValidationError(
        "payload/string-too-large",
        "commit message exceeds generic string cap",
        "message",
      );
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

  handle(IPC_CHANNELS.git.fetch, async (_event, payload) =>
    gitService.fetch(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
    ),
  );

  handle(IPC_CHANNELS.git.diffFile, async (_event, payload) =>
    gitService.diffFile(
      requireAllowedRepositoryPath(payload, getAllowedRepositoryRoots),
      requireFilePath(payload),
      requireStaged(payload),
    ),
  );
}
