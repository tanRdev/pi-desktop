import type { GitRepositoryInspection } from "../git-worktree-service";

type WorkspaceActivationOptions = {
  createIfMissing?: boolean;
};

type RepositoryInspection = GitRepositoryInspection & {
  status: "repository";
  rootPath: string;
  currentWorktreePath: string;
  worktrees: unknown[];
};

type WorkspaceActivationRouterDeps<
  TAttached,
  THost extends object,
  TContext,
> = {
  inspectPath(targetPath: string): GitRepositoryInspection;
  attachToPath(
    targetPath: string,
    options?: WorkspaceActivationOptions,
  ): Promise<TAttached | null>;
  commitAttachment(attached: TAttached): void;
  selectFolderWorkspace(
    targetPath: string,
    message: string,
    subscribeToHost: (host: THost) => () => void,
  ): void;
  subscribeToHost(host: THost): () => void;
  nonRepositoryWorkspaceMessage: string;
  resolveDefaultThreadContext(
    targetPath: string,
    options?: WorkspaceActivationOptions,
  ): Promise<TContext | null>;
  switchContextInBackground(context: TContext): void;
  upsertRepository(input: { rootPath: string }): { id: string };
  selectWorktreeWithoutThread(repositoryId: string, worktreePath: string): void;
  notifySessionChanged(): void;
};

function isRepositoryInspection(
  inspection: GitRepositoryInspection,
): inspection is RepositoryInspection {
  return (
    inspection.status === "repository" &&
    typeof inspection.rootPath === "string" &&
    typeof inspection.currentWorktreePath === "string" &&
    Array.isArray(inspection.worktrees)
  );
}

export function createWorkspaceActivationRouter<
  TAttached,
  THost extends object,
  TContext,
>(deps: WorkspaceActivationRouterDeps<TAttached, THost, TContext>) {
  async function activateWorkspacePath(
    targetPath: string,
    options: WorkspaceActivationOptions = {},
  ): Promise<void> {
    const inspection = deps.inspectPath(targetPath);

    if (isRepositoryInspection(inspection)) {
      const attached = await deps.attachToPath(targetPath, options);
      if (attached) {
        deps.commitAttachment(attached);
      }
      return;
    }

    if (inspection.status === "not_repo") {
      deps.selectFolderWorkspace(
        targetPath,
        deps.nonRepositoryWorkspaceMessage,
        deps.subscribeToHost,
      );
      return;
    }

    throw new Error(inspection.message ?? "Selected directory is unavailable");
  }

  async function switchRepositoryPath(
    targetPath: string,
    options: WorkspaceActivationOptions = {},
  ): Promise<void> {
    const inspection = deps.inspectPath(targetPath);

    if (isRepositoryInspection(inspection)) {
      const context = await deps.resolveDefaultThreadContext(
        targetPath,
        options,
      );
      if (!context) {
        const repositoryEntry = deps.upsertRepository({
          rootPath: inspection.rootPath,
        });
        deps.selectWorktreeWithoutThread(
          repositoryEntry.id,
          inspection.currentWorktreePath,
        );
        return;
      }

      deps.switchContextInBackground(context);
      return;
    }

    await activateWorkspacePath(targetPath, options);
    deps.notifySessionChanged();
  }

  return {
    activateWorkspacePath,
    switchRepositoryPath,
  };
}
