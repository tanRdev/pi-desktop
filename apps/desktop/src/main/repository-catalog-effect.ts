import path from "node:path";
import { Effect } from "effect";
import { createModuleLogger, RepositoryError, trySync } from "./effect";
import { PersistentJsonFile } from "./persistent-json-file";

export interface RepositoryCatalogEntry {
  id: string;
  rootPath: string;
  label: string | null;
  order: number;
  lastSelectedWorktreeId: string | null;
  addedAt: number;
  updatedAt: number;
}

type RepositoryCatalogState = {
  version: 1;
  repositories: RepositoryCatalogEntry[];
};

type RepositoryCatalogOptions = {
  now?: () => number;
};

type UpsertRepositoryInput = {
  rootPath: string;
  label?: string | null;
};

const DEFAULT_STATE: RepositoryCatalogState = {
  version: 1,
  repositories: [],
};

const logger = createModuleLogger("RepositoryCatalog");

function normalizePathId(value: string): string {
  const resolved = path.resolve(value);
  return resolved.replace(/[\\/]+$/, "") || resolved;
}

function hasLabel(input: UpsertRepositoryInput): boolean {
  return Object.hasOwn(input, "label");
}

export class RepositoryCatalogEffect {
  private readonly store: PersistentJsonFile<RepositoryCatalogState>;
  private readonly now: () => number;

  constructor(userDataPath: string, options: RepositoryCatalogOptions = {}) {
    this.store = new PersistentJsonFile({
      filePath: path.join(userDataPath, "catalog", "repositories.json"),
      defaultValue: DEFAULT_STATE,
    });
    this.now = options.now ?? (() => Date.now());
  }

  list(): Effect.Effect<RepositoryCatalogEntry[], RepositoryError> {
    return Effect.gen(this, function* () {
      yield* logger.info("Listing repositories");

      const state = yield* trySync(
        () => this.store.get(),
        (error) =>
          new RepositoryError({
            message: "Failed to list repositories",
            cause: error,
          }),
      );

      return [...state.repositories].sort(
        (left, right) => left.order - right.order,
      );
    });
  }

  get(
    repositoryId: string,
  ): Effect.Effect<RepositoryCatalogEntry | null, RepositoryError> {
    return Effect.gen(this, function* () {
      yield* logger.info(`Getting repository: ${repositoryId}`);

      const normalizedId = normalizePathId(repositoryId);
      const list = yield* this.list();

      return list.find((repository) => repository.id === normalizedId) ?? null;
    });
  }

  upsert(
    input: UpsertRepositoryInput,
  ): Effect.Effect<RepositoryCatalogEntry, RepositoryError> {
    return Effect.gen(this, function* () {
      const rootPath = normalizePathId(input.rootPath);
      yield* logger.info(`Upserting repository: ${rootPath}`);

      const currentTime = this.now();

      const nextState = yield* trySync(
        () =>
          this.store.update((state) => {
            const repositories = [...state.repositories];
            const existingIndex = repositories.findIndex(
              (repository) => repository.id === rootPath,
            );

            if (existingIndex >= 0) {
              const existing = repositories[existingIndex];
              if (!existing) {
                return state;
              }
              repositories[existingIndex] = {
                ...existing,
                label: hasLabel(input) ? (input.label ?? null) : existing.label,
                updatedAt: currentTime,
              };

              return {
                ...state,
                repositories,
              };
            }

            const nextOrder = repositories.reduce(
              (maxOrder, repository) => Math.max(maxOrder, repository.order),
              -1,
            );
            repositories.push({
              id: rootPath,
              rootPath,
              label: input.label ?? null,
              order: nextOrder + 1,
              lastSelectedWorktreeId: null,
              addedAt: currentTime,
              updatedAt: currentTime,
            });

            return {
              ...state,
              repositories,
            };
          }),
        (error) =>
          new RepositoryError({
            message: `Failed to upsert repository: ${rootPath}`,
            repositoryId: rootPath,
            cause: error,
          }),
      );

      const entry = nextState.repositories.find(
        (repository) => repository.id === rootPath,
      );

      if (!entry) {
        return yield* Effect.fail(
          new RepositoryError({
            message: `Repository catalog entry missing after upsert: ${rootPath}`,
            repositoryId: rootPath,
          }),
        );
      }

      yield* logger.info(`Repository upserted successfully: ${rootPath}`);
      return entry;
    });
  }

  setLastSelectedWorktree(
    repositoryId: string,
    worktreeId: string | null,
  ): Effect.Effect<RepositoryCatalogEntry | null, RepositoryError> {
    return Effect.gen(this, function* () {
      const normalizedRepositoryId = normalizePathId(repositoryId);
      const normalizedWorktreeId = worktreeId
        ? normalizePathId(worktreeId)
        : null;

      yield* logger.info(
        `Setting last selected worktree for ${normalizedRepositoryId}: ${normalizedWorktreeId}`,
      );

      const currentTime = this.now();

      const nextState = yield* trySync(
        () =>
          this.store.update((state) => ({
            ...state,
            repositories: state.repositories.map((repository) =>
              repository.id === normalizedRepositoryId
                ? {
                    ...repository,
                    lastSelectedWorktreeId: normalizedWorktreeId,
                    updatedAt: currentTime,
                  }
                : repository,
            ),
          })),
        (error) =>
          new RepositoryError({
            message: `Failed to set last selected worktree for: ${normalizedRepositoryId}`,
            repositoryId: normalizedRepositoryId,
            cause: error,
          }),
      );

      return (
        nextState.repositories.find(
          (repository) => repository.id === normalizedRepositoryId,
        ) ?? null
      );
    });
  }

  reorder(
    repositoryIds: string[],
  ): Effect.Effect<RepositoryCatalogEntry[], RepositoryError> {
    return Effect.gen(this, function* () {
      yield* logger.info(`Reordering ${repositoryIds.length} repositories`);

      const normalizedRepositoryIds = repositoryIds.map(normalizePathId);
      const currentTime = this.now();

      const nextState = yield* trySync(
        () =>
          this.store.update((state) => {
            const repositories = [...state.repositories].sort(
              (left, right) => left.order - right.order,
            );
            const repositoriesById = new Map(
              repositories.map((repository) => [repository.id, repository]),
            );
            const seenRepositoryIds = new Set<string>();
            const reorderedRepositories: RepositoryCatalogEntry[] = [];

            for (const repositoryId of normalizedRepositoryIds) {
              if (seenRepositoryIds.has(repositoryId)) {
                continue;
              }

              const repository = repositoriesById.get(repositoryId);
              if (!repository) {
                continue;
              }

              seenRepositoryIds.add(repositoryId);
              reorderedRepositories.push(repository);
            }

            for (const repository of repositories) {
              if (!seenRepositoryIds.has(repository.id)) {
                reorderedRepositories.push(repository);
              }
            }

            return {
              ...state,
              repositories: reorderedRepositories.map((repository, order) =>
                repository.order === order
                  ? repository
                  : {
                      ...repository,
                      order,
                      updatedAt: currentTime,
                    },
              ),
            };
          }),
        (error) =>
          new RepositoryError({
            message: "Failed to reorder repositories",
            cause: error,
          }),
      );

      return [...nextState.repositories].sort(
        (left, right) => left.order - right.order,
      );
    });
  }

  remove(repositoryId: string): Effect.Effect<void, RepositoryError> {
    return Effect.gen(this, function* () {
      const normalizedRepositoryId = normalizePathId(repositoryId);
      yield* logger.info(`Removing repository: ${normalizedRepositoryId}`);

      yield* trySync(
        () =>
          this.store.update((state) => ({
            ...state,
            repositories: state.repositories.filter(
              (repository) => repository.id !== normalizedRepositoryId,
            ),
          })),
        (error) =>
          new RepositoryError({
            message: `Failed to remove repository: ${normalizedRepositoryId}`,
            repositoryId: normalizedRepositoryId,
            cause: error,
          }),
      );

      yield* logger.info(`Repository removed: ${normalizedRepositoryId}`);
    });
  }
}

// Export a factory function for backward compatibility
export function createRepositoryCatalog(
  userDataPath: string,
  options?: RepositoryCatalogOptions,
): RepositoryCatalogEffect {
  return new RepositoryCatalogEffect(userDataPath, options);
}
