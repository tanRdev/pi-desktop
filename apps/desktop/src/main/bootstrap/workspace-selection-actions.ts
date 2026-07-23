import path from "node:path";
import type { RepositoryCatalog } from "../catalogs/repository-catalog";
import type { SelectionState } from "../catalogs/selection-state";

export type WorkspaceSelectionSession<THost extends object | null> = {
  getContext(): { repositoryId: string } | null;
  clearSession(host: THost): void;
  replaceHost(
    host: THost,
    options?: {
      context?: { repositoryId: string } | null;
      transport?: { close(): void } | null;
      subscribe?: () => () => void;
      closePreviousTransport?: boolean;
    },
  ): void;
};

/** @deprecated Prefer WorkspaceSelectionSession — kept for test fixtures during migration. */
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
  session: WorkspaceSelectionSession<THost>;
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
    session,
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
      session.getContext()?.repositoryId ?? selectionState.get().repositoryId
    );
  }

  function selectWorktreeWithoutThread(
    repositoryId: string | null,
    worktreePath: string,
  ): void {
    if (repositoryId) {
      repositoryCatalog.setLastSelectedWorktree(repositoryId, worktreePath);
    }

    session.clearSession(
      createBootstrapErrorHost(
        "No active session is selected for this workspace",
      ),
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
    const nextHost = createBootstrapErrorHost(message);

    session.replaceHost(nextHost, {
      context: null,
      transport: null,
      subscribe: () => subscribeToHost(nextHost),
    });
    selectionState.replace({
      repositoryId: repositoryEntry.id,
      worktreeId: null,
      threadId: null,
    });
  }

  return {
    getRepositoryIdForWorktree,
    selectWorktreeWithoutThread,
    selectFolderWorkspace,
  };
}

/** Adapter for tests that still construct a mutable bag. */
export function workspaceSelectionSessionFromState<THost extends object | null>(
  state: WorkspaceSelectionContextState<THost>,
): WorkspaceSelectionSession<THost> {
  return {
    getContext: () => state.currentContext,
    clearSession: (host) => {
      state.currentContext = null;
      state.currentTransport?.close();
      state.currentTransport = null;
      state.unsubscribe();
      state.unsubscribe = () => {};
      state.currentHost = host;
    },
    replaceHost: (host, options = {}) => {
      const previousTransport = state.currentTransport;
      const previousUnsubscribe = state.unsubscribe;

      state.currentContext =
        options.context === undefined ? state.currentContext : options.context;
      state.currentHost = host;
      state.currentTransport =
        options.transport === undefined ? null : options.transport;
      state.unsubscribe = options.subscribe ? options.subscribe() : () => {};

      previousUnsubscribe();
      if (options.closePreviousTransport !== false) {
        previousTransport?.close();
      }
    },
  };
}
