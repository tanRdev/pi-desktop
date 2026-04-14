import path from "node:path";
import type { RepositoryPreferences } from "@pi-desktop/shared";
import { PersistentJsonFile } from "./persistent-json-file";
import type { RepositoryCatalogEntry } from "./repository-catalog";

type RepositoryPreferencesDocument = {
  version: 1;
  repositories: RepositoryPreferences[];
};

const DEFAULT_DOCUMENT: RepositoryPreferencesDocument = {
  version: 1,
  repositories: [],
};

function normalizePathId(value: string): string {
  const resolved = path.resolve(value);
  return resolved.replace(/[\\/]+$/, "") || resolved;
}

function normalizePreferences(
  repositoryId: string,
  preferences: Partial<Omit<RepositoryPreferences, "repositoryId">>,
): RepositoryPreferences {
  return {
    repositoryId: normalizePathId(repositoryId),
    customName: preferences.customName ?? null,
    icon: preferences.icon ?? null,
    accentColor: preferences.accentColor ?? null,
  };
}

export class RepositoryPreferencesCatalog {
  private readonly store: PersistentJsonFile<RepositoryPreferencesDocument>;

  constructor(userDataPath: string) {
    this.store = new PersistentJsonFile({
      filePath: path.join(
        userDataPath,
        "catalog",
        "repository-preferences.json",
      ),
      defaultValue: DEFAULT_DOCUMENT,
    });
  }

  list(): RepositoryPreferences[] {
    return this.store.get().repositories;
  }

  get(repositoryId: string): RepositoryPreferences | null {
    const normalizedRepositoryId = normalizePathId(repositoryId);
    return (
      this.list().find(
        (repository) => repository.repositoryId === normalizedRepositoryId,
      ) ?? null
    );
  }

  upsert(
    repositoryId: string,
    updates: Partial<Omit<RepositoryPreferences, "repositoryId">>,
  ): RepositoryPreferences {
    const normalizedRepositoryId = normalizePathId(repositoryId);
    const nextState = this.store.update((state) => {
      const repositories = [...state.repositories];
      const index = repositories.findIndex(
        (repository) => repository.repositoryId === normalizedRepositoryId,
      );
      const existing = index >= 0 ? repositories[index] : null;
      const nextEntry = normalizePreferences(normalizedRepositoryId, {
        customName:
          updates.customName === undefined
            ? existing?.customName
            : updates.customName,
        icon: updates.icon === undefined ? existing?.icon : updates.icon,
        accentColor:
          updates.accentColor === undefined
            ? existing?.accentColor
            : updates.accentColor,
      });

      if (index >= 0) {
        repositories[index] = nextEntry;
      } else {
        repositories.push(nextEntry);
      }

      return {
        ...state,
        repositories,
      };
    });

    return (
      nextState.repositories.find(
        (repository) => repository.repositoryId === normalizedRepositoryId,
      ) ?? normalizePreferences(normalizedRepositoryId, updates)
    );
  }

  importLegacyLabels(
    repositories: RepositoryCatalogEntry[],
  ): RepositoryPreferences[] {
    const imported: RepositoryPreferences[] = [];

    for (const repository of repositories) {
      if (!repository.label) {
        continue;
      }

      const existing = this.get(repository.id);
      if (existing?.customName) {
        continue;
      }

      imported.push(
        this.upsert(repository.id, {
          customName: repository.label,
        }),
      );
    }

    return imported;
  }

  remove(repositoryId: string): void {
    const normalizedRepositoryId = normalizePathId(repositoryId);
    this.store.update((state) => ({
      ...state,
      repositories: state.repositories.filter(
        (repository) => repository.repositoryId !== normalizedRepositoryId,
      ),
    }));
  }
}
