import path from "node:path";
import { DocumentCatalog } from "@pi-desktop/shared";
import { PersistentJsonFile } from "./persistent-json-file";

export interface AppSelectionState {
  repositoryId: string | null;
  worktreeId: string | null;
  threadId: string | null;
}

type SelectionDocument = AppSelectionState & {
  version: 1;
};

type SelectionMutation = (selection: AppSelectionState) => AppSelectionState;

const EMPTY_SELECTION: AppSelectionState = {
  repositoryId: null,
  worktreeId: null,
  threadId: null,
};

const DEFAULT_SELECTION: SelectionDocument = {
  version: 1,
  ...EMPTY_SELECTION,
};

function normalizeSelectionId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/[\\/]+$/, "") || value;
}

function readSelection(document: SelectionDocument): AppSelectionState {
  return {
    repositoryId: document.repositoryId,
    worktreeId: document.worktreeId,
    threadId: document.threadId,
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
    SelectionDocument,
    AppSelectionState,
    SelectionMutation
  >;

  constructor(userDataPath: string) {
    const store = new PersistentJsonFile({
      filePath: path.join(userDataPath, "catalog", "selection.json"),
      defaultValue: DEFAULT_SELECTION,
    });

    this.catalog = new DocumentCatalog({
      store,
      select: readSelection,
      applyUpdate: (document, mutate) => ({
        ...document,
        ...mutate(readSelection(document)),
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
