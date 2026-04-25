import type {
  GitFileDiff,
  GitRepositoryStatus,
  TerminalCreateOptions,
  TerminalSession,
} from "@pi-desktop/shared";
import { Context, Effect } from "effect";
import type { GitRepositoryInspection } from "../git-worktree-service";
import type { PersistentJsonFileOptions } from "../persistent-json-file";
import type { RepositoryCatalogEntry } from "../repository-catalog";
import type { TerminalInstance } from "../terminal-manager";
import {
  type FileSystemError,
  GitError,
  RepositoryError,
  TerminalError,
} from "./errors";

// ===========================================================================
// RepositoryCatalogService
// ===========================================================================

export interface RepositoryCatalogServiceOps {
  readonly list: Effect.Effect<RepositoryCatalogEntry[], RepositoryError>;
  readonly get: (
    id: string,
  ) => Effect.Effect<RepositoryCatalogEntry | null, RepositoryError>;
  readonly upsert: (input: {
    rootPath: string;
    label?: string | null;
  }) => Effect.Effect<RepositoryCatalogEntry, RepositoryError>;
  readonly remove: (id: string) => Effect.Effect<void, RepositoryError>;
  readonly setLastSelectedWorktree: (
    repositoryId: string,
    worktreeId: string | null,
  ) => Effect.Effect<RepositoryCatalogEntry | null, RepositoryError>;
  readonly reorder: (
    ids: string[],
  ) => Effect.Effect<RepositoryCatalogEntry[], RepositoryError>;
}

export class RepositoryCatalogService extends Effect.Service<RepositoryCatalogService>()(
  "RepositoryCatalogService",
  {
    succeed: {
      list: Effect.fail(new RepositoryError({ message: "not implemented" })),
      get: (_id: string) =>
        Effect.fail(new RepositoryError({ message: "not implemented" })),
      upsert: (_input: { rootPath: string; label?: string | null }) =>
        Effect.fail(new RepositoryError({ message: "not implemented" })),
      remove: (_id: string) =>
        Effect.fail(new RepositoryError({ message: "not implemented" })),
      setLastSelectedWorktree: (
        _repositoryId: string,
        _worktreeId: string | null,
      ) => Effect.fail(new RepositoryError({ message: "not implemented" })),
      reorder: (_ids: string[]) =>
        Effect.fail(new RepositoryError({ message: "not implemented" })),
    } satisfies RepositoryCatalogServiceOps,
  },
) {}

export const RepositoryCatalog =
  Context.GenericTag<RepositoryCatalogServiceOps>(
    "@pi-desktop/RepositoryCatalogService",
  );

// ===========================================================================
// GitWorktreeServiceService
// ===========================================================================

export interface GitWorktreeServiceServiceOps {
  readonly inspect: (
    targetPath: string,
  ) => Effect.Effect<GitRepositoryInspection, GitError>;
  readonly inspectAsync: (
    targetPath: string,
  ) => Effect.Effect<GitRepositoryInspection, GitError>;
  readonly isRepository: (
    targetPath: string,
  ) => Effect.Effect<boolean, GitError>;
  readonly init: (targetPath: string) => Effect.Effect<void, GitError>;
  readonly createWorktree: (options: {
    repositoryRoot: string;
    branchName: string;
    worktreePath: string;
    baseBranch?: string;
  }) => Effect.Effect<string, GitError>;
  readonly removeWorktree: (options: {
    worktreePath: string;
    repositoryRoot: string;
  }) => Effect.Effect<void, GitError>;
  readonly getRepositoryStatus: (
    repositoryPath: string,
  ) => Effect.Effect<GitRepositoryStatus, GitError>;
  readonly stageFile: (
    repositoryPath: string,
    filePath: string,
  ) => Effect.Effect<GitRepositoryStatus, GitError>;
  readonly stageFiles: (
    repositoryPath: string,
    filePaths: string[],
  ) => Effect.Effect<GitRepositoryStatus, GitError>;
  readonly unstageFile: (
    repositoryPath: string,
    filePath: string,
  ) => Effect.Effect<GitRepositoryStatus, GitError>;
  readonly unstageFiles: (
    repositoryPath: string,
    filePaths: string[],
  ) => Effect.Effect<GitRepositoryStatus, GitError>;
  readonly discardFile: (
    repositoryPath: string,
    filePath: string,
  ) => Effect.Effect<GitRepositoryStatus, GitError>;
  readonly commit: (
    repositoryPath: string,
    message: string,
  ) => Effect.Effect<GitRepositoryStatus, GitError>;
  readonly pull: (
    repositoryPath: string,
  ) => Effect.Effect<GitRepositoryStatus, GitError>;
  readonly push: (
    repositoryPath: string,
  ) => Effect.Effect<GitRepositoryStatus, GitError>;
  readonly fetch: (
    repositoryPath: string,
  ) => Effect.Effect<GitRepositoryStatus, GitError>;
  readonly diffFile: (
    repositoryPath: string,
    filePath: string,
    staged: boolean,
  ) => Effect.Effect<GitFileDiff, GitError>;
}

export class GitWorktreeServiceService extends Effect.Service<GitWorktreeServiceService>()(
  "GitWorktreeServiceService",
  {
    succeed: {
      inspect: (_targetPath: string) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      inspectAsync: (_targetPath: string) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      isRepository: (_targetPath: string) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      init: (_targetPath: string) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      createWorktree: (_options: {
        repositoryRoot: string;
        branchName: string;
        worktreePath: string;
        baseBranch?: string;
      }) => Effect.fail(new GitError({ message: "not implemented" })),
      removeWorktree: (_options: {
        worktreePath: string;
        repositoryRoot: string;
      }) => Effect.fail(new GitError({ message: "not implemented" })),
      getRepositoryStatus: (_repositoryPath: string) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      stageFile: (_repositoryPath: string, _filePath: string) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      stageFiles: (_repositoryPath: string, _filePaths: string[]) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      unstageFile: (_repositoryPath: string, _filePath: string) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      unstageFiles: (_repositoryPath: string, _filePaths: string[]) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      discardFile: (_repositoryPath: string, _filePath: string) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      commit: (_repositoryPath: string, _message: string) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      pull: (_repositoryPath: string) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      push: (_repositoryPath: string) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      fetch: (_repositoryPath: string) =>
        Effect.fail(new GitError({ message: "not implemented" })),
      diffFile: (
        _repositoryPath: string,
        _filePath: string,
        _staged: boolean,
      ) => Effect.fail(new GitError({ message: "not implemented" })),
    } satisfies GitWorktreeServiceServiceOps,
  },
) {}

export const GitWorktreeService =
  Context.GenericTag<GitWorktreeServiceServiceOps>(
    "@pi-desktop/GitWorktreeServiceService",
  );

// ===========================================================================
// TerminalManagerService
// ===========================================================================

export interface TerminalManagerServiceOps {
  readonly create: (
    id: string,
    opts: TerminalCreateOptions,
    ownerWebContentsId?: number | string,
  ) => Effect.Effect<TerminalSession, TerminalError>;
  readonly write: (
    id: string,
    data: string,
  ) => Effect.Effect<void, TerminalError>;
  readonly resize: (
    id: string,
    cols: number,
    rows: number,
  ) => Effect.Effect<void, TerminalError>;
  readonly destroy: (id: string) => Effect.Effect<void, TerminalError>;
  readonly destroyAsync: (id: string) => Effect.Effect<void, TerminalError>;
  readonly destroyAll: Effect.Effect<void, TerminalError>;
  readonly destroyAllAsync: Effect.Effect<void, TerminalError>;
  readonly get: (
    id: string,
  ) => Effect.Effect<TerminalInstance | null, TerminalError>;
  readonly getSessions: Effect.Effect<TerminalSession[], TerminalError>;
  readonly isAvailable: Effect.Effect<boolean, never>;
  readonly initialize: Effect.Effect<void, TerminalError>;
  readonly setMainWindow: (
    mainWindow: import("electron").BrowserWindow,
  ) => Effect.Effect<void, TerminalError>;
  readonly isOwnedBy: (
    id: string,
    senderKey: number | string,
  ) => Effect.Effect<boolean, TerminalError>;
}

export class TerminalManagerService extends Effect.Service<TerminalManagerService>()(
  "TerminalManagerService",
  {
    succeed: {
      create: (
        _id: string,
        _opts: TerminalCreateOptions,
        _ownerWebContentsId?: number | string,
      ) => Effect.fail(new TerminalError({ message: "not implemented" })),
      write: (_id: string, _data: string) =>
        Effect.fail(new TerminalError({ message: "not implemented" })),
      resize: (_id: string, _cols: number, _rows: number) =>
        Effect.fail(new TerminalError({ message: "not implemented" })),
      destroy: (_id: string) =>
        Effect.fail(new TerminalError({ message: "not implemented" })),
      destroyAsync: (_id: string) =>
        Effect.fail(new TerminalError({ message: "not implemented" })),
      destroyAll: Effect.fail(
        new TerminalError({ message: "not implemented" }),
      ),
      destroyAllAsync: Effect.fail(
        new TerminalError({ message: "not implemented" }),
      ),
      get: (_id: string) =>
        Effect.fail(new TerminalError({ message: "not implemented" })),
      getSessions: Effect.fail(
        new TerminalError({ message: "not implemented" }),
      ),
      isAvailable: Effect.succeed(false),
      initialize: Effect.fail(
        new TerminalError({ message: "not implemented" }),
      ),
      setMainWindow: (_mainWindow: import("electron").BrowserWindow) =>
        Effect.fail(new TerminalError({ message: "not implemented" })),
      isOwnedBy: (_id: string, _senderKey: number | string) =>
        Effect.fail(new TerminalError({ message: "not implemented" })),
    } satisfies TerminalManagerServiceOps,
  },
) {}

export const TerminalManager = Context.GenericTag<TerminalManagerServiceOps>(
  "@pi-desktop/TerminalManagerService",
);

// ===========================================================================
// PersistentJsonFileService
// ===========================================================================

export interface PersistentJsonFileRef<T> {
  readonly id: string;
  readonly _type: unique symbol;
  _value?: T;
}

export interface PersistentJsonFileServiceOps {
  readonly get: <T>(
    store: PersistentJsonFileRef<T>,
  ) => Effect.Effect<T, FileSystemError>;
  readonly set: <T>(
    store: PersistentJsonFileRef<T>,
    value: T,
  ) => Effect.Effect<T, FileSystemError>;
  readonly update: <T>(
    store: PersistentJsonFileRef<T>,
    updater: (current: T) => T,
  ) => Effect.Effect<T, FileSystemError>;
  readonly flush: <T>(
    store: PersistentJsonFileRef<T>,
  ) => Effect.Effect<void, FileSystemError>;
  readonly create: <T>(
    options: PersistentJsonFileOptions<T>,
  ) => Effect.Effect<PersistentJsonFileRef<T>, FileSystemError>;
}

export class PersistentJsonFileService extends Effect.Service<PersistentJsonFileService>()(
  "PersistentJsonFileService",
  {
    succeed: Effect.void,
  },
) {}

export const PersistentJsonFile =
  Context.GenericTag<PersistentJsonFileServiceOps>(
    "@pi-desktop/PersistentJsonFileService",
  );
