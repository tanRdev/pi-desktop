import path from "node:path";
import {
  DocumentCatalog,
  type RepositoryPreferences,
  type VersionedEnvelope,
  wrapEnvelope,
} from "@pi-desktop/shared";
import { PersistentJsonFile } from "./persistent-json-file";
import { recoverCorruptFile } from "./recover-corrupt-file";
import type { RepositoryCatalogEntry } from "./repository-catalog";
import {
  createVersionedDocumentStore,
  validateVersionedDocument,
} from "./versioned-document-store";

const CURRENT_VERSION = 1;
const CATALOG_NAME = "repository-preferences-catalog";

type RepositoryPreferencesDocumentData = {
  repositories: RepositoryPreferences[];
};

type RepositoryPreferencesEnvelope =
  VersionedEnvelope<RepositoryPreferencesDocumentData>;

const DEFAULT_DATA: RepositoryPreferencesDocumentData = {
  repositories: [],
};

type RepositoryPreferencesMutation = (
  repositories: RepositoryPreferences[],
) => RepositoryPreferences[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePathId(value: string): string {
  const resolved = path.resolve(value);
  return resolved.replace(/[\\/]+$/, "") || resolved;
}

function decodeRepositoryPreferencesEntry(
  raw: unknown,
): RepositoryPreferences | null {
  if (!isRecord(raw)) return null;
  const repositoryId = raw.repositoryId;
  if (typeof repositoryId !== "string" || repositoryId.length === 0) {
    return null;
  }

  const customName = raw.customName;
  const icon = raw.icon;
  const accentColor = raw.accentColor;

  if (
    customName !== null &&
    customName !== undefined &&
    typeof customName !== "string"
  ) {
    return null;
  }
  if (icon !== null && icon !== undefined && typeof icon !== "string") {
    return null;
  }
  if (
    accentColor !== null &&
    accentColor !== undefined &&
    typeof accentColor !== "string"
  ) {
    return null;
  }

  return {
    repositoryId: normalizePathId(repositoryId),
    customName: customName ?? null,
    icon: icon ?? null,
    accentColor: accentColor ?? null,
  };
}

function decodeRepositoryPreferencesDocumentData(
  raw: unknown,
): RepositoryPreferencesDocumentData | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.repositories)) return null;

  const repositories = raw.repositories.flatMap((entry) => {
    const decoded = decodeRepositoryPreferencesEntry(entry);
    return decoded ? [decoded] : [];
  });

  return { repositories };
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
    RepositoryPreferencesEnvelope,
    RepositoryPreferences[],
    RepositoryPreferencesMutation
  >;

  constructor(userDataPath: string) {
    const filePath = path.join(
      userDataPath,
      "catalog",
      "repository-preferences.json",
    );

    recoverCorruptFile(filePath, CATALOG_NAME, {
      currentVersion: CURRENT_VERSION,
      decode: decodeRepositoryPreferencesDocumentData,
    });

    const file = new PersistentJsonFile<unknown>({
      filePath,
      defaultValue: wrapEnvelope(DEFAULT_DATA, CURRENT_VERSION),
      validate: (raw): raw is unknown =>
        validateVersionedDocument(raw, decodeRepositoryPreferencesDocumentData),
    });

    const store = createVersionedDocumentStore(file, {
      currentVersion: CURRENT_VERSION,
      defaultData: DEFAULT_DATA,
      decode: decodeRepositoryPreferencesDocumentData,
    });

    this.catalog = new DocumentCatalog({
      store,
      select: (document) => document.data.repositories,
      applyUpdate: (document, mutate) => ({
        schemaVersion: CURRENT_VERSION,
        data: {
          repositories: mutate(document.data.repositories),
        },
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
