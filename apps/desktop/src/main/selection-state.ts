import path from "node:path";
import { PersistentJsonFile } from "./persistent-json-file";

export interface AppSelectionState {
  repositoryId: string | null;
  worktreeId: string | null;
  threadId: string | null;
}

type SelectionDocument = AppSelectionState & {
  version: 1;
};

const DEFAULT_SELECTION: SelectionDocument = {
  version: 1,
  repositoryId: null,
  worktreeId: null,
  threadId: null,
};

function normalizeSelectionId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/[\\/]+$/, "") || value;
}

export class SelectionState {
  private readonly store: PersistentJsonFile<SelectionDocument>;

  constructor(userDataPath: string) {
    this.store = new PersistentJsonFile({
      filePath: path.join(userDataPath, "catalog", "selection.json"),
      defaultValue: DEFAULT_SELECTION,
    });
  }

  get(): AppSelectionState {
    const { version: _version, ...selection } = this.store.get();
    return selection;
  }

  set(nextSelection: Partial<AppSelectionState>): AppSelectionState {
    const current = this.get();
    const merged: AppSelectionState = {
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
    };

    return this.replace(merged);
  }

  replace(nextSelection: AppSelectionState): AppSelectionState {
    const nextDocument: SelectionDocument = {
      version: 1,
      repositoryId: normalizeSelectionId(nextSelection.repositoryId),
      worktreeId: normalizeSelectionId(nextSelection.worktreeId),
      threadId: nextSelection.threadId,
    };
    this.store.set(nextDocument);
    return this.get();
  }

  clear(): AppSelectionState {
    this.store.set(DEFAULT_SELECTION);
    return this.get();
  }
}
