import path from "node:path";
import {
  DocumentCatalog,
  type RepositoryPreferences,
} from "@pi-desktop/shared";
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

type RepositoryPreferencesMutation = (
  repositories: RepositoryPreferences[],
) => RepositoryPreferences[];

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
  private readonly catalog: DocumentCatalog<
    RepositoryPreferencesDocument,
    RepositoryPreferences[],
    RepositoryPreferencesMutation
  >;

  constructor(userDataPath: string) {
    const store = new PersistentJsonFile({
      filePath: path.join(
        userDataPath,
        "catalog",
        "repository-preferences.json",
      ),
      defaultValue: DEFAULT_DOCUMENT,
    });

    this.catalog = new DocumentCatalog({
      store,
      select: (document) => document.repositories,
      applyUpdate: (document, mutate) => ({
        ...document,
        repositories: mutate(document.repositories),
      }),
    });
  }

  list(): RepositoryPreferences[] {
    return this.catalog.get();
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
    const repositories = this.catalog.update((currentRepositories) => {
      const nextRepositories = [...currentRepositories];
      const index = nextRepositories.findIndex(
        (repository) => repository.repositoryId === normalizedRepositoryId,
      );
      const existing = index >= 0 ? nextRepositories[index] : null;
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
        nextRepositories[index] = nextEntry;
      } else {
        nextRepositories.push(nextEntry);
      }

      return nextRepositories;
    });

    return (
      repositories.find(
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
    this.catalog.update((repositories) =>
      repositories.filter(
        (repository) => repository.repositoryId !== normalizedRepositoryId,
      ),
    );
  }
}
