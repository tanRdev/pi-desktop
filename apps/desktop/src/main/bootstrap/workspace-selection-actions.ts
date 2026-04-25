import path from "node:path";
import type { RepositoryCatalog } from "../repository-catalog";
import type { SelectionState } from "../selection-state";

export type WorkspaceSelectionContextState<
  THost extends object | null = object | null,
> = {
  currentContext: { repositoryId: string } | null;
  currentTransport: { close(): void } | null;
  unsubscribe: () => void;
  currentHost: THost;
};

type WorkspaceSelectionActionsDependencies<THost extends object | null> = {
  repositoryCatalog: Pick<
    RepositoryCatalog,
    "list" | "setLastSelectedWorktree" | "upsert"
  >;
  selectionState: Pick<SelectionState, "get" | "replace">;
  state: WorkspaceSelectionContextState<THost>;
  createBootstrapErrorHost: (message: string) => THost;
  notifySessionChanged: () => void;
};

function normalizePathId(value: string): string {
  const resolved = path.resolve(value);
  return resolved.replace(/[\\/]+$/, "") || resolved;
}

export function createWorkspaceSelectionActions<THost extends object | null>(
  dependencies: WorkspaceSelectionActionsDependencies<THost>,
) {
  const {
    repositoryCatalog,
    selectionState,
    state,
    createBootstrapErrorHost,
    notifySessionChanged,
  } = dependencies;

  function getRepositoryIdForWorktree(worktreeId: string): string | null {
    const normalizedWorktreeId = normalizePathId(worktreeId);

    for (const repository of repositoryCatalog.list()) {
      if (
        normalizedWorktreeId === repository.rootPath ||
        normalizedWorktreeId.startsWith(`${repository.rootPath}${path.sep}`)
      ) {
        return repository.id;
      }
    }

    return (
      state.currentContext?.repositoryId ?? selectionState.get().repositoryId
    );
  }

  function selectWorktreeWithoutThread(
    repositoryId: string | null,
    worktreePath: string,
  ): void {
    if (repositoryId) {
      repositoryCatalog.setLastSelectedWorktree(repositoryId, worktreePath);
    }

    state.currentContext = null;
    state.currentTransport?.close();
    state.currentTransport = null;
    state.unsubscribe();
    state.unsubscribe = () => {};
    state.currentHost = createBootstrapErrorHost(
      "No active session is selected for this workspace",
    );
    selectionState.replace({
      repositoryId,
      worktreeId: worktreePath,
      threadId: null,
    });
    notifySessionChanged();
  }

  function selectFolderWorkspace(
    targetPath: string,
    message: string,
    subscribeToHost: (host: THost) => () => void,
  ): void {
    const repositoryEntry = repositoryCatalog.upsert({ rootPath: targetPath });
    const previousTransport = state.currentTransport;
    const previousUnsubscribe = state.unsubscribe;
    const nextHost = createBootstrapErrorHost(message);

    state.currentContext = null;
    state.currentHost = nextHost;
    state.currentTransport = null;
    state.unsubscribe = subscribeToHost(nextHost);
    selectionState.replace({
      repositoryId: repositoryEntry.id,
      worktreeId: null,
      threadId: null,
    });

    previousUnsubscribe();
    previousTransport?.close();
  }

  return {
    getRepositoryIdForWorktree,
    selectWorktreeWithoutThread,
    selectFolderWorkspace,
  };
}
