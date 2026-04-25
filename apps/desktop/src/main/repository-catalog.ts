import path from "node:path";
import { DocumentCatalog } from "@pi-desktop/shared";
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

type RepositoryCatalogMutation = (
  repositories: RepositoryCatalogEntry[],
) => RepositoryCatalogEntry[];

type UpsertRepositoryInput = {
  rootPath: string;
  label?: string | null;
};

const DEFAULT_STATE: RepositoryCatalogState = {
  version: 1,
  repositories: [],
};

function normalizePathId(value: string): string {
  const resolved = path.resolve(value);
  return resolved.replace(/[\\/]+$/, "") || resolved;
}

function hasLabel(input: UpsertRepositoryInput): boolean {
  return Object.hasOwn(input, "label");
}

export class RepositoryCatalog {
  private readonly catalog: DocumentCatalog<
    RepositoryCatalogState,
    RepositoryCatalogEntry[],
    RepositoryCatalogMutation
  >;

  private readonly now: () => number;

  constructor(userDataPath: string, options: RepositoryCatalogOptions = {}) {
    const store = new PersistentJsonFile({
      filePath: path.join(userDataPath, "catalog", "repositories.json"),
      defaultValue: DEFAULT_STATE,
    });

    this.catalog = new DocumentCatalog({
      store,
      select: (document) => document.repositories,
      applyUpdate: (document, mutate) => ({
        ...document,
        repositories: mutate(document.repositories),
      }),
    });
    this.now = options.now ?? (() => Date.now());
  }

  list(): RepositoryCatalogEntry[] {
    return [...this.catalog.get()].sort(
      (left, right) => left.order - right.order,
    );
  }

  get(repositoryId: string): RepositoryCatalogEntry | null {
    const normalizedId = normalizePathId(repositoryId);
    return (
      this.list().find((repository) => repository.id === normalizedId) ?? null
    );
  }

  upsert(input: UpsertRepositoryInput): RepositoryCatalogEntry {
    const rootPath = normalizePathId(input.rootPath);
    const currentTime = this.now();
    const repositories = this.catalog.update((currentRepositories) => {
      const nextRepositories = [...currentRepositories];
      const existingIndex = nextRepositories.findIndex(
        (repository) => repository.id === rootPath,
      );

      if (existingIndex >= 0) {
        const existing = nextRepositories[existingIndex];
        if (!existing) {
          return currentRepositories;
        }
        nextRepositories[existingIndex] = {
          ...existing,
          label: hasLabel(input) ? (input.label ?? null) : existing.label,
          updatedAt: currentTime,
        };

        return nextRepositories;
      }

      const nextOrder = nextRepositories.reduce(
        (maxOrder, repository) => Math.max(maxOrder, repository.order),
        -1,
      );
      nextRepositories.push({
        id: rootPath,
        rootPath,
        label: input.label ?? null,
        order: nextOrder + 1,
        lastSelectedWorktreeId: null,
        addedAt: currentTime,
        updatedAt: currentTime,
      });

      return nextRepositories;
    });

    return (
      repositories.find((repository) => repository.id === rootPath) ??
      this.get(rootPath) ??
      (() => {
        throw new Error(
          `Repository catalog entry missing after upsert: ${rootPath}`,
        );
      })()
    );
  }

  setLastSelectedWorktree(
    repositoryId: string,
    worktreeId: string | null,
  ): RepositoryCatalogEntry | null {
    const normalizedRepositoryId = normalizePathId(repositoryId);
    const normalizedWorktreeId = worktreeId
      ? normalizePathId(worktreeId)
      : null;
    const currentTime = this.now();
    const repositories = this.catalog.update((currentRepositories) =>
      currentRepositories.map((repository) =>
        repository.id === normalizedRepositoryId
          ? {
              ...repository,
              lastSelectedWorktreeId: normalizedWorktreeId,
              updatedAt: currentTime,
            }
          : repository,
      ),
    );

    return (
      repositories.find(
        (repository) => repository.id === normalizedRepositoryId,
      ) ?? null
    );
  }

  reorder(repositoryIds: string[]): RepositoryCatalogEntry[] {
    const normalizedRepositoryIds = repositoryIds.map(normalizePathId);
    const currentTime = this.now();

    const repositories = this.catalog.update((currentRepositories) => {
      const sortedRepositories = [...currentRepositories].sort(
        (left, right) => left.order - right.order,
      );
      const repositoriesById = new Map(
        sortedRepositories.map((repository) => [repository.id, repository]),
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

      for (const repository of sortedRepositories) {
        if (!seenRepositoryIds.has(repository.id)) {
          reorderedRepositories.push(repository);
        }
      }

      return reorderedRepositories.map((repository, order) =>
        repository.order === order
          ? repository
          : {
              ...repository,
              order,
              updatedAt: currentTime,
            },
      );
    });

    return [...repositories].sort((left, right) => left.order - right.order);
  }

  remove(repositoryId: string): void {
    const normalizedRepositoryId = normalizePathId(repositoryId);
    this.catalog.update((repositories) =>
      repositories.filter(
        (repository) => repository.id !== normalizedRepositoryId,
      ),
    );
  }
}
