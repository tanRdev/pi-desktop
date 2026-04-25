import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type {
  RepositoryCatalog,
  RepositoryCatalogEntry,
} from "../repository-catalog";
import type { SelectionState } from "../selection-state";
import {
  createWorkspaceSelectionActions,
  type WorkspaceSelectionContextState,
} from "./workspace-selection-actions";

function createSelectionStateMock(initialSelection: {
  repositoryId: string | null;
  worktreeId: string | null;
  threadId: string | null;
}): Pick<SelectionState, "get" | "replace"> {
  const normalizeId = (value: string | null): string | null => {
    if (!value) {
      return null;
    }

    return value.replace(/[\\/]+$/, "") || value;
  };
  let selection = initialSelection;

  return {
    get: () => selection,
    replace: (nextSelection) => {
      selection = {
        repositoryId: normalizeId(nextSelection.repositoryId),
        worktreeId: normalizeId(nextSelection.worktreeId),
        threadId: nextSelection.threadId,
      };
      return selection;
    },
  };
}

function createRepositoryEntry(rootPath: string): RepositoryCatalogEntry {
  const normalizedRootPath = path.resolve(rootPath);

  return {
    id: normalizedRootPath,
    rootPath: normalizedRootPath,
    label: null,
    order: 0,
    lastSelectedWorktreeId: null,
    addedAt: 0,
    updatedAt: 0,
  };
}

describe("createWorkspaceSelectionActions", () => {
  it("selects a worktree without a thread using the matching repository", () => {
    const repositoryCatalog = {
      list: () => [createRepositoryEntry("/repos/alpha")],
      setLastSelectedWorktree: vi.fn(),
      upsert: vi.fn(() => createRepositoryEntry("/repos/alpha")),
    } satisfies Pick<
      RepositoryCatalog,
      "list" | "setLastSelectedWorktree" | "upsert"
    >;
    const selectionState = createSelectionStateMock({
      repositoryId: null,
      worktreeId: null,
      threadId: null,
    });
    const state: WorkspaceSelectionContextState = {
      currentContext: {
        repositoryId: path.resolve("/repos/other"),
      },
      currentTransport: { close: vi.fn() },
      unsubscribe: vi.fn(),
      currentHost: { name: "old-host" },
    };
    const createBootstrapErrorHost = vi.fn((message: string) => ({ message }));
    const notifySessionChanged = vi.fn();

    const actions = createWorkspaceSelectionActions({
      repositoryCatalog,
      selectionState,
      state,
      createBootstrapErrorHost,
      notifySessionChanged,
    });

    actions.selectWorktreeWithoutThread(
      actions.getRepositoryIdForWorktree("/repos/alpha/worktrees/feature/"),
      "/repos/alpha/worktrees/feature/",
    );

    expect(repositoryCatalog.setLastSelectedWorktree).toHaveBeenCalledWith(
      path.resolve("/repos/alpha"),
      "/repos/alpha/worktrees/feature/",
    );
    expect(state.currentContext).toBeNull();
    expect(state.currentTransport).toBeNull();
    expect(state.unsubscribe).not.toBeUndefined();
    expect(createBootstrapErrorHost).toHaveBeenCalledWith(
      "No active session is selected for this workspace",
    );
    expect(selectionState.get()).toEqual({
      repositoryId: path.resolve("/repos/alpha"),
      worktreeId: path.resolve("/repos/alpha/worktrees/feature"),
      threadId: null,
    });
    expect(notifySessionChanged).toHaveBeenCalledTimes(1);
  });

  it("falls back to the active repository when a worktree does not match a catalog entry", () => {
    const repositoryCatalog = {
      list: () => [createRepositoryEntry("/repos/alpha")],
      setLastSelectedWorktree: vi.fn(),
      upsert: vi.fn(() => createRepositoryEntry("/repos/alpha")),
    } satisfies Pick<
      RepositoryCatalog,
      "list" | "setLastSelectedWorktree" | "upsert"
    >;
    const selectionState = createSelectionStateMock({
      repositoryId: path.resolve("/repos/from-selection"),
      worktreeId: null,
      threadId: null,
    });
    const state: WorkspaceSelectionContextState = {
      currentContext: {
        repositoryId: path.resolve("/repos/from-context"),
      },
      currentTransport: null,
      unsubscribe: vi.fn(),
      currentHost: null,
    };

    const actions = createWorkspaceSelectionActions({
      repositoryCatalog,
      selectionState,
      state,
      createBootstrapErrorHost: vi.fn((message: string) => ({ message })),
      notifySessionChanged: vi.fn(),
    });

    expect(actions.getRepositoryIdForWorktree("/elsewhere/worktree")).toBe(
      path.resolve("/repos/from-context"),
    );

    state.currentContext = null;

    expect(actions.getRepositoryIdForWorktree("/elsewhere/worktree")).toBe(
      path.resolve("/repos/from-selection"),
    );
  });

  it("selects a non-repository folder workspace with host replacement and cleanup", () => {
    const replacementHost = {
      message: "This folder is open, but it is not a git repository.",
    };
    const previousTransport = { close: vi.fn() };
    const previousUnsubscribe = vi.fn();
    const repositoryCatalog = {
      list: () => [],
      setLastSelectedWorktree: vi.fn(),
      upsert: vi.fn(() => createRepositoryEntry("/folders/plain")),
    } satisfies Pick<
      RepositoryCatalog,
      "list" | "setLastSelectedWorktree" | "upsert"
    >;
    const selectionState = createSelectionStateMock({
      repositoryId: null,
      worktreeId: path.resolve("/repos/alpha/worktrees/feature"),
      threadId: "thread-1",
    });
    const state: WorkspaceSelectionContextState = {
      currentContext: {
        repositoryId: path.resolve("/repos/alpha"),
      },
      currentTransport: previousTransport,
      unsubscribe: previousUnsubscribe,
      currentHost: { message: "old" },
    };
    const createBootstrapErrorHost = vi.fn(() => replacementHost);

    const actions = createWorkspaceSelectionActions({
      repositoryCatalog,
      selectionState,
      state,
      createBootstrapErrorHost,
      notifySessionChanged: vi.fn(),
    });

    actions.selectFolderWorkspace(
      "/folders/plain",
      "This folder is open, but it is not a git repository.",
      () => () => {},
    );

    expect(repositoryCatalog.upsert).toHaveBeenCalledWith({
      rootPath: "/folders/plain",
    });
    expect(state.currentContext).toBeNull();
    expect(state.currentHost).toBe(replacementHost);
    expect(state.currentTransport).toBeNull();
    expect(createBootstrapErrorHost).toHaveBeenCalledWith(
      "This folder is open, but it is not a git repository.",
    );
    expect(selectionState.get()).toEqual({
      repositoryId: path.resolve("/folders/plain"),
      worktreeId: null,
      threadId: null,
    });
    expect(previousUnsubscribe).toHaveBeenCalledTimes(1);
    expect(previousTransport.close).toHaveBeenCalledTimes(1);
  });
});
