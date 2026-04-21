import type { RepositoryCatalogEntry } from "../repository-catalog";
import type { AppSelectionState } from "../selection-state";

type ResolveInitialWorkspaceTargetInput = {
  selection: AppSelectionState;
  repositories: RepositoryCatalogEntry[];
};

type InitialWorkspaceTarget = {
  preferredWorkspacePath: string | null;
  fallbackWorkspacePath: string | null;
  shouldPreserveEmptySelection: boolean;
};

function getRememberedWorkspacePath(
  repositories: RepositoryCatalogEntry[],
): string | null {
  const firstRepository = repositories[0];
  if (!firstRepository) {
    return null;
  }

  return firstRepository.lastSelectedWorktreeId ?? firstRepository.rootPath;
}

export function resolveInitialWorkspaceTarget(
  input: ResolveInitialWorkspaceTargetInput,
): InitialWorkspaceTarget {
  const rememberedWorkspacePath = getRememberedWorkspacePath(
    input.repositories,
  );
  const preferredWorkspacePath =
    input.selection.worktreeId ??
    input.selection.repositoryId ??
    rememberedWorkspacePath;

  return {
    preferredWorkspacePath,
    fallbackWorkspacePath:
      preferredWorkspacePath === rememberedWorkspacePath
        ? null
        : rememberedWorkspacePath,
    shouldPreserveEmptySelection:
      input.selection.threadId === null &&
      (input.selection.worktreeId !== null ||
        input.selection.repositoryId !== null),
  };
}
