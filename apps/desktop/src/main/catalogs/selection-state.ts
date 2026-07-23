import path from "node:path";
import {
  DocumentCatalog,
  type VersionedEnvelope,
  wrapEnvelope,
} from "@pi-desktop/shared";
import { PersistentJsonFile } from "./persistent-json-file";
import { recoverCorruptFile } from "./recover-corrupt-file";
import {
  createVersionedDocumentStore,
  validateVersionedDocument,
} from "./versioned-document-store";

const CURRENT_VERSION = 1;
const CATALOG_NAME = "selection-state";

export interface AppSelectionState {
  repositoryId: string | null;
  worktreeId: string | null;
  threadId: string | null;
}

type SelectionDocumentData = AppSelectionState;

type SelectionEnvelope = VersionedEnvelope<SelectionDocumentData>;

type SelectionMutation = (selection: AppSelectionState) => AppSelectionState;

const EMPTY_SELECTION: AppSelectionState = {
  repositoryId: null,
  worktreeId: null,
  threadId: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSelectionId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/[\\/]+$/, "") || value;
}

function decodeSelectionDocumentData(
  raw: unknown,
): SelectionDocumentData | null {
  if (!isRecord(raw)) return null;

  const repositoryId = raw.repositoryId;
  const worktreeId = raw.worktreeId;
  const threadId = raw.threadId;

  if (
    repositoryId !== null &&
    repositoryId !== undefined &&
    typeof repositoryId !== "string"
  ) {
    return null;
  }
  if (
    worktreeId !== null &&
    worktreeId !== undefined &&
    typeof worktreeId !== "string"
  ) {
    return null;
  }
  if (
    threadId !== null &&
    threadId !== undefined &&
    typeof threadId !== "string"
  ) {
    return null;
  }

  return {
    repositoryId: normalizeSelectionId(
      repositoryId === undefined ? null : repositoryId,
    ),
    worktreeId: normalizeSelectionId(
      worktreeId === undefined ? null : worktreeId,
    ),
    threadId: threadId === undefined ? null : threadId,
  };
}

function normalizeSelection(selection: AppSelectionState): AppSelectionState {
  return {
    repositoryId: normalizeSelectionId(selection.repositoryId),
    worktreeId: normalizeSelectionId(selection.worktreeId),
    threadId: selection.threadId,
  };
}

export class SelectionState {
  private readonly catalog: DocumentCatalog<
    SelectionEnvelope,
    AppSelectionState,
    SelectionMutation
  >;

  constructor(userDataPath: string) {
    const filePath = path.join(userDataPath, "catalog", "selection.json");

    recoverCorruptFile(filePath, CATALOG_NAME, {
      currentVersion: CURRENT_VERSION,
      decode: decodeSelectionDocumentData,
    });

    const file = new PersistentJsonFile<unknown>({
      filePath,
      defaultValue: wrapEnvelope(EMPTY_SELECTION, CURRENT_VERSION),
      validate: (raw): raw is unknown =>
        validateVersionedDocument(raw, decodeSelectionDocumentData),
    });

    const store = createVersionedDocumentStore(file, {
      currentVersion: CURRENT_VERSION,
      defaultData: EMPTY_SELECTION,
      decode: decodeSelectionDocumentData,
    });

    this.catalog = new DocumentCatalog({
      store,
      select: (document) => document.data,
      applyUpdate: (document, mutate) => ({
        schemaVersion: CURRENT_VERSION,
        data: mutate(document.data),
      }),
    });
  }

  get(): AppSelectionState {
    return this.catalog.get();
  }

  set(nextSelection: Partial<AppSelectionState>): AppSelectionState {
    return this.catalog.update((current) => ({
      repositoryId:
        nextSelection.repositoryId === undefined
          ? current.repositoryId
          : normalizeSelectionId(nextSelection.repositoryId),
      worktreeId:
        nextSelection.worktreeId === undefined
          ? current.worktreeId
          : normalizeSelectionId(nextSelection.worktreeId),
      threadId:
        nextSelection.threadId === undefined
          ? current.threadId
          : nextSelection.threadId,
    }));
  }

  replace(nextSelection: AppSelectionState): AppSelectionState {
    return this.catalog.update(() => normalizeSelection(nextSelection));
  }

  clear(): AppSelectionState {
    return this.catalog.update(() => EMPTY_SELECTION);
  }
}
