import { Effect, Layer } from "effect";
import type { GitWorktreeService as GitWorktreeServiceClass } from "../git-worktree-service";
import type { PersistentJsonFileOptions } from "../persistent-json-file";
import { PersistentJsonFile as PersistentJsonFileClass } from "../persistent-json-file";
import type { RepositoryCatalog as RepositoryCatalogClass } from "../repository-catalog";
import type {
  TerminalInstance,
  TerminalManager as TerminalManagerClass,
} from "../terminal-manager";
import {
  FileSystemError,
  GitError,
  RepositoryError,
  TerminalError,
} from "./errors";
import {
  type GitWorktreeServiceServiceOps,
  GitWorktreeService as GitWorktreeServiceTag,
  type PersistentJsonFileRef,
  type PersistentJsonFileServiceOps,
  PersistentJsonFile as PersistentJsonFileTag,
  type RepositoryCatalogServiceOps,
  RepositoryCatalog as RepositoryCatalogTag,
  type TerminalManagerServiceOps,
  TerminalManager as TerminalManagerTag,
} from "./services";

// ---------------------------------------------------------------------------
// RepositoryCatalogLive
// ---------------------------------------------------------------------------

export const RepositoryCatalogLive = (
  catalog: RepositoryCatalogClass,
): Layer.Layer<RepositoryCatalogServiceOps, never, never> =>
  Layer.succeed(RepositoryCatalogTag, {
    list: Effect.try({
      try: () => catalog.list(),
      catch: (e) =>
        new RepositoryError({
          message: "Failed to list repositories",
          cause: e,
        }),
    }),
    get: (id: string) =>
      Effect.try({
        try: () => catalog.get(id),
        catch: (e) =>
          new RepositoryError({
            message: "Failed to get repository",
            repositoryId: id,
            cause: e,
          }),
      }),
    upsert: (input: Parameters<RepositoryCatalogClass["upsert"]>[0]) =>
      Effect.try({
        try: () => catalog.upsert(input),
        catch: (e) =>
          new RepositoryError({
            message: "Failed to upsert repository",
            cause: e,
          }),
      }),
    remove: (id: string) =>
      Effect.try({
        try: () => catalog.remove(id),
        catch: (e) =>
          new RepositoryError({
            message: "Failed to remove repository",
            repositoryId: id,
            cause: e,
          }),
      }),
    setLastSelectedWorktree: (
      repositoryId: string,
      worktreeId: string | null,
    ) =>
      Effect.try({
        try: () => catalog.setLastSelectedWorktree(repositoryId, worktreeId),
        catch: (e) =>
          new RepositoryError({
            message: "Failed to set last selected worktree",
            repositoryId,
            cause: e,
          }),
      }),
    reorder: (ids: string[]) =>
      Effect.try({
        try: () => catalog.reorder(ids),
        catch: (e) =>
          new RepositoryError({
            message: "Failed to reorder repositories",
            cause: e,
          }),
      }),
  });

// ---------------------------------------------------------------------------
// GitWorktreeServiceLive
// ---------------------------------------------------------------------------

export const GitWorktreeServiceLive = (
  service: GitWorktreeServiceClass,
): Layer.Layer<GitWorktreeServiceServiceOps, never, never> =>
  Layer.succeed(GitWorktreeServiceTag, {
    inspect: (targetPath: string) =>
      Effect.try({
        try: () => service.inspect(targetPath),
        catch: (e) =>
          new GitError({
            message: "Git inspect failed",
            path: targetPath,
            cause: e,
          }),
      }),
    inspectAsync: (targetPath: string) =>
      Effect.tryPromise({
        try: () => service.inspectAsync(targetPath),
        catch: (e) =>
          new GitError({
            message: "Git inspectAsync failed",
            path: targetPath,
            cause: e,
          }),
      }),
    isRepository: (targetPath: string) =>
      Effect.try({
        try: () => service.isRepository(targetPath),
        catch: (e) =>
          new GitError({
            message: "Git isRepository check failed",
            path: targetPath,
            cause: e,
          }),
      }),
    init: (targetPath: string) =>
      Effect.try({
        try: () => service.init(targetPath),
        catch: (e) =>
          new GitError({
            message: "Git init failed",
            path: targetPath,
            cause: e,
          }),
      }),
    createWorktree: (
      options: Parameters<GitWorktreeServiceClass["createWorktree"]>[0],
    ) =>
      Effect.try({
        try: () => service.createWorktree(options),
        catch: (e) =>
          new GitError({
            message: "Failed to create worktree",
            path: options.repositoryRoot,
            cause: e,
          }),
      }),
    removeWorktree: (
      options: Parameters<GitWorktreeServiceClass["removeWorktree"]>[0],
    ) =>
      Effect.try({
        try: () => service.removeWorktree(options),
        catch: (e) =>
          new GitError({
            message: "Failed to remove worktree",
            path: options.worktreePath,
            cause: e,
          }),
      }),
    getRepositoryStatus: (repositoryPath: string) =>
      Effect.try({
        try: () => service.getRepositoryStatus(repositoryPath),
        catch: (e) =>
          new GitError({
            message: "Failed to get repository status",
            path: repositoryPath,
            cause: e,
          }),
      }),
    stageFile: (repositoryPath: string, filePath: string) =>
      Effect.try({
        try: () => service.stageFile(repositoryPath, filePath),
        catch: (e) =>
          new GitError({
            message: "Failed to stage file",
            path: repositoryPath,
            cause: e,
          }),
      }),
    stageFiles: (repositoryPath: string, filePaths: string[]) =>
      Effect.try({
        try: () => service.stageFiles(repositoryPath, filePaths),
        catch: (e) =>
          new GitError({
            message: "Failed to stage files",
            path: repositoryPath,
            cause: e,
          }),
      }),
    unstageFile: (repositoryPath: string, filePath: string) =>
      Effect.try({
        try: () => service.unstageFile(repositoryPath, filePath),
        catch: (e) =>
          new GitError({
            message: "Failed to unstage file",
            path: repositoryPath,
            cause: e,
          }),
      }),
    unstageFiles: (repositoryPath: string, filePaths: string[]) =>
      Effect.try({
        try: () => service.unstageFiles(repositoryPath, filePaths),
        catch: (e) =>
          new GitError({
            message: "Failed to unstage files",
            path: repositoryPath,
            cause: e,
          }),
      }),
    discardFile: (repositoryPath: string, filePath: string) =>
      Effect.try({
        try: () => service.discardFile(repositoryPath, filePath),
        catch: (e) =>
          new GitError({
            message: "Failed to discard file",
            path: repositoryPath,
            cause: e,
          }),
      }),
    commit: (repositoryPath: string, message: string) =>
      Effect.try({
        try: () => service.commit(repositoryPath, message),
        catch: (e) =>
          new GitError({
            message: "Git commit failed",
            path: repositoryPath,
            cause: e,
          }),
      }),
    pull: (repositoryPath: string) =>
      Effect.try({
        try: () => service.pull(repositoryPath),
        catch: (e) =>
          new GitError({
            message: "Git pull failed",
            path: repositoryPath,
            cause: e,
          }),
      }),
    push: (repositoryPath: string) =>
      Effect.try({
        try: () => service.push(repositoryPath),
        catch: (e) =>
          new GitError({
            message: "Git push failed",
            path: repositoryPath,
            cause: e,
          }),
      }),
    fetch: (repositoryPath: string) =>
      Effect.try({
        try: () => service.fetch(repositoryPath),
        catch: (e) =>
          new GitError({
            message: "Git fetch failed",
            path: repositoryPath,
            cause: e,
          }),
      }),
    diffFile: (repositoryPath: string, filePath: string, staged: boolean) =>
      Effect.try({
        try: () => service.diffFile(repositoryPath, filePath, staged),
        catch: (e) =>
          new GitError({
            message: "Git diff failed",
            path: repositoryPath,
            cause: e,
          }),
      }),
  });

// ---------------------------------------------------------------------------
// TerminalManagerLive
// ---------------------------------------------------------------------------

export const TerminalManagerLive = (
  manager: TerminalManagerClass,
): Layer.Layer<TerminalManagerServiceOps, never, never> =>
  Layer.succeed(TerminalManagerTag, {
    create: (
      id: string,
      opts: Parameters<TerminalManagerClass["create"]>[1],
      ownerWebContentsId?: number | string,
    ) =>
      Effect.try({
        try: () => manager.create(id, opts, ownerWebContentsId),
        catch: (e) =>
          new TerminalError({
            message: "Terminal create failed",
            terminalId: id,
            cause: e,
          }),
      }),
    write: (id: string, data: string) =>
      Effect.try({
        try: () => manager.write(id, data),
        catch: (e) =>
          new TerminalError({
            message: "Terminal write failed",
            terminalId: id,
            cause: e,
          }),
      }),
    resize: (id: string, cols: number, rows: number) =>
      Effect.try({
        try: () => manager.resize(id, cols, rows),
        catch: (e) =>
          new TerminalError({
            message: "Terminal resize failed",
            terminalId: id,
            cause: e,
          }),
      }),
    destroy: (id: string) =>
      Effect.try({
        try: () => manager.destroy(id),
        catch: (e) =>
          new TerminalError({
            message: "Terminal destroy failed",
            terminalId: id,
            cause: e,
          }),
      }),
    destroyAsync: (id: string) =>
      Effect.tryPromise({
        try: () => manager.destroyAsync(id),
        catch: (e) =>
          new TerminalError({
            message: "Terminal destroyAsync failed",
            terminalId: id,
            cause: e,
          }),
      }),
    destroyAll: Effect.try({
      try: () => manager.destroyAll(),
      catch: (e) =>
        new TerminalError({
          message: "Terminal destroyAll failed",
          cause: e,
        }),
    }),
    destroyAllAsync: Effect.tryPromise({
      try: () => manager.destroyAllAsync(),
      catch: (e) =>
        new TerminalError({
          message: "Terminal destroyAllAsync failed",
          cause: e,
        }),
    }),
    get: (id: string) =>
      Effect.try({
        try: (): TerminalInstance | null => manager.get(id) ?? null,
        catch: (e) =>
          new TerminalError({
            message: "Terminal get failed",
            terminalId: id,
            cause: e,
          }),
      }),
    getSessions: Effect.try({
      try: () => manager.getSessions(),
      catch: (e) =>
        new TerminalError({
          message: "Terminal getSessions failed",
          cause: e,
        }),
    }),
    isAvailable: Effect.sync(() => manager.isAvailable()),
    initialize: Effect.try({
      try: () => manager.initialize(),
      catch: (e) =>
        new TerminalError({
          message: "Terminal initialize failed",
          cause: e,
        }),
    }),
    setMainWindow: (mainWindow: import("electron").BrowserWindow) =>
      Effect.try({
        try: () => manager.setMainWindow(mainWindow),
        catch: (e) =>
          new TerminalError({
            message: "Terminal setMainWindow failed",
            cause: e,
          }),
      }),
    isOwnedBy: (id: string, senderKey: number | string) =>
      Effect.try({
        try: () => manager.isOwnedBy(id, senderKey),
        catch: (e) =>
          new TerminalError({
            message: "Terminal isOwnedBy failed",
            terminalId: id,
            cause: e,
          }),
      }),
  });

// ---------------------------------------------------------------------------
// PersistentJsonFileLive
//
// Uses a private WeakMap to associate PersistentJsonFileRef tokens with their
// underlying PersistentJsonFile instances. The ref's _value stores the current
// T value, while the WeakMap holds the class instance for method delegation.
// ---------------------------------------------------------------------------

const persistentJsonFileInstances = new WeakMap<
  PersistentJsonFileRef<unknown>,
  PersistentJsonFileClass<unknown>
>();

export const PersistentJsonFileLive: Layer.Layer<
  PersistentJsonFileServiceOps,
  never,
  never
> = Layer.succeed(PersistentJsonFileTag, {
  get: <T>(store: PersistentJsonFileRef<T>) =>
    Effect.try({
      try: () => {
        const instance = persistentJsonFileInstances.get(
          store as PersistentJsonFileRef<unknown>,
        );
        if (!instance) {
          throw new Error(
            `PersistentJsonFile ref "${store.id}" has not been initialized`,
          );
        }
        return instance.get() as T;
      },
      catch: (e) =>
        new FileSystemError({
          message: "Failed to read persistent store",
          cause: e,
        }),
    }),
  set: <T>(store: PersistentJsonFileRef<T>, value: T) =>
    Effect.try({
      try: () => {
        const instance = persistentJsonFileInstances.get(
          store as PersistentJsonFileRef<unknown>,
        );
        if (!instance) {
          throw new Error(
            `PersistentJsonFile ref "${store.id}" has not been initialized`,
          );
        }
        return instance.set(value) as T;
      },
      catch: (e) =>
        new FileSystemError({
          message: "Failed to set persistent store value",
          cause: e,
        }),
    }),
  update: <T>(store: PersistentJsonFileRef<T>, updater: (current: T) => T) =>
    Effect.try({
      try: () => {
        const instance = persistentJsonFileInstances.get(
          store as PersistentJsonFileRef<unknown>,
        );
        if (!instance) {
          throw new Error(
            `PersistentJsonFile ref "${store.id}" has not been initialized`,
          );
        }
        return (instance as PersistentJsonFileClass<T>).update(updater);
      },
      catch: (e) =>
        new FileSystemError({
          message: "Failed to update persistent store value",
          cause: e,
        }),
    }),
  flush: <T>(store: PersistentJsonFileRef<T>) =>
    Effect.tryPromise({
      try: () => {
        const instance = persistentJsonFileInstances.get(
          store as PersistentJsonFileRef<unknown>,
        );
        if (!instance) {
          throw new Error(
            `PersistentJsonFile ref "${store.id}" has not been initialized`,
          );
        }
        return instance.flush();
      },
      catch: (e) =>
        new FileSystemError({
          message: "Failed to flush persistent store",
          cause: e,
        }),
    }),
  create: <T>(options: PersistentJsonFileOptions<T>) =>
    Effect.sync(() => {
      const instance = new PersistentJsonFileClass(options);
      const ref: PersistentJsonFileRef<T> = {
        id: options.filePath,
        _type: Symbol.for(
          `@pi-desktop/PersistentJsonFile/${options.filePath}`,
        ) as PersistentJsonFileRef<T>["_type"],
        _value: instance.get(),
      };
      persistentJsonFileInstances.set(
        ref as PersistentJsonFileRef<unknown>,
        instance as PersistentJsonFileClass<unknown>,
      );
      return ref;
    }),
});
