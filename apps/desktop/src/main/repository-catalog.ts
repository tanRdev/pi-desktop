import path from "node:path";
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

function normalizePathId(value: string): string {
  const resolved = path.resolve(value);
  return resolved.replace(/[\\/]+$/, "") || resolved;
}

function hasLabel(input: UpsertRepositoryInput): boolean {
  return Object.prototype.hasOwnProperty.call(input, "label");
}

export class RepositoryCatalog {
  private readonly store: PersistentJsonFile<RepositoryCatalogState>;

  private readonly now: () => number;

  constructor(userDataPath: string, options: RepositoryCatalogOptions = {}) {
    this.store = new PersistentJsonFile({
      filePath: path.join(userDataPath, "catalog", "repositories.json"),
      defaultValue: DEFAULT_STATE,
    });
    this.now = options.now ?? (() => Date.now());
  }

  list(): RepositoryCatalogEntry[] {
    return this.store
      .get()
      .repositories.sort((left, right) => left.order - right.order);
  }

  get(repositoryId: string): RepositoryCatalogEntry | null {
    const normalizedId = normalizePathId(repositoryId);
    return this.list().find((repository) => repository.id === normalizedId) ?? null;
  }

  upsert(input: UpsertRepositoryInput): RepositoryCatalogEntry {
    const rootPath = normalizePathId(input.rootPath);
    const currentTime = this.now();
    const nextState = this.store.update((state) => {
      const repositories = [...state.repositories];
      const existingIndex = repositories.findIndex(
        (repository) => repository.id === rootPath,
      );

      if (existingIndex >= 0) {
        const existing = repositories[existingIndex]!;
        repositories[existingIndex] = {
          ...existing,
          label: hasLabel(input) ? input.label ?? null : existing.label,
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
    });

    return (
      nextState.repositories.find((repository) => repository.id === rootPath) ??
      this.get(rootPath) ??
      (() => {
        throw new Error(`Repository catalog entry missing after upsert: ${rootPath}`);
      })()
    );
  }

  setLastSelectedWorktree(
    repositoryId: string,
    worktreeId: string | null,
  ): RepositoryCatalogEntry | null {
    const normalizedRepositoryId = normalizePathId(repositoryId);
    const normalizedWorktreeId = worktreeId ? normalizePathId(worktreeId) : null;
    const currentTime = this.now();
    const nextState = this.store.update((state) => ({
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
    }));

    return (
      nextState.repositories.find(
        (repository) => repository.id === normalizedRepositoryId,
      ) ?? null
    );
  }

  remove(repositoryId: string): void {
    const normalizedRepositoryId = normalizePathId(repositoryId);
    this.store.update((state) => ({
      ...state,
      repositories: state.repositories.filter(
        (repository) => repository.id !== normalizedRepositoryId,
      ),
    }));
  }
}
