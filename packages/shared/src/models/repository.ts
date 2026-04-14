import type { WorktreeSnapshot } from "./worktree.js";

export interface RepositorySnapshot {
  id: string;
  order?: number;
  name: string;
  customName?: string | null;
  icon?: string | null;
  accentColor?: string | null;
  rootPath: string;
  defaultBranch: string | null;
  worktrees: WorktreeSnapshot[];
}

export function moveRepositorySnapshots(
  repositories: RepositorySnapshot[],
  draggedRepositoryId: string,
  targetRepositoryId: string,
): RepositorySnapshot[] {
  if (draggedRepositoryId === targetRepositoryId) {
    return repositories;
  }

  const sourceIndex = repositories.findIndex(
    (repository) => repository.id === draggedRepositoryId,
  );
  const targetIndex = repositories.findIndex(
    (repository) => repository.id === targetRepositoryId,
  );

  if (sourceIndex < 0 || targetIndex < 0) {
    return repositories;
  }

  const nextRepositories = [...repositories];
  const [draggedRepository] = nextRepositories.splice(sourceIndex, 1);

  if (!draggedRepository) {
    return repositories;
  }

  nextRepositories.splice(targetIndex, 0, draggedRepository);
  return nextRepositories;
}
