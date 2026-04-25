import type {
  AgentSnapshot,
  RepositoryPreferences,
  ShellSnapshot,
  WorkspaceSession,
} from "@pi-desktop/shared";
import { Effect } from "effect";
import { fromUnknownError } from "../effect/errors";
import { runEffect } from "../effect/runtime";
import type { GitRepositoryInspection } from "../git-worktree-service";
import type { RepositoryCatalogEntry } from "../repository-catalog";
import type { AppSelectionState, SelectionState } from "../selection-state";
import { buildShellCatalog } from "../shell-catalog-builder";
import {
  type CreateShellSnapshotOptions,
  createShellSnapshot as createShellSnapshotDefault,
} from "../shell-snapshot";
import type { ThreadCatalogEntry } from "../thread-catalog";
import type {
  ThreadRuntimeDescriptor,
  ThreadRuntimeRef,
} from "../thread-runtime-manager";
import type { SelectedThreadContext } from "./thread-context";

const AGENT_BOOTSTRAP_ERROR_SESSION_ID = "bootstrap-error";

type ShellStateHost = {
  getSnapshot(): Promise<AgentSnapshot>;
};

type CreateShellStateIpcDependencies = {
  appName: string;
  appVersion: string;
  chromeVersion?: string;
  electronVersion?: string;
  platform: NodeJS.Platform | string;
  env: Record<string, string | undefined>;
  isPackaged: boolean;
  preferredWorkspacePath: string | null;
  getCurrentHost(): ShellStateHost;
  getCurrentContext(): SelectedThreadContext | null;
  selectionState: Pick<SelectionState, "get" | "replace">;
  repositoryCatalog: {
    list(): RepositoryCatalogEntry[];
  };
  repositoryPreferencesCatalog: {
    list(): RepositoryPreferences[];
  };
  workspaceSessionCatalog: {
    list(): WorkspaceSession[];
    replaceAll(sessions: WorkspaceSession[]): WorkspaceSession[];
  };
  gitService: {
    inspect(targetPath: string): GitRepositoryInspection;
    inspectAsync(targetPath: string): Promise<GitRepositoryInspection>;
  };
  threadCatalog: {
    listByWorktree(worktreeId: string): ThreadCatalogEntry[];
  };
  runtimeManager: {
    getRuntimeState(thread: ThreadRuntimeRef): Promise<ThreadRuntimeDescriptor>;
  };
  createShellSnapshot?: (options: CreateShellSnapshotOptions) => ShellSnapshot;
};

function createBootstrapErrorSnapshot(message: string): AgentSnapshot {
  return {
    sessionId: AGENT_BOOTSTRAP_ERROR_SESSION_ID,
    status: "error",
    messages: [],
    lastError: message,
  };
}

async function getAgentSnapshot(host: ShellStateHost): Promise<AgentSnapshot> {
  return runEffect(
    Effect.tryPromise({
      try: () => host.getSnapshot(),
      catch: (error) => fromUnknownError(error, "getSnapshot"),
    }).pipe(
      Effect.catchAll((error) =>
        Effect.succeed(createBootstrapErrorSnapshot(error.message)),
      ),
    ),
  );
}

function listAllowedWorkspacePaths(
  deps: CreateShellStateIpcDependencies,
): string[] {
  const roots: string[] = [];

  for (const entry of deps.repositoryCatalog.list()) {
    roots.push(entry.rootPath);

    const inspection = deps.gitService.inspect(entry.rootPath);
    if (!inspection.worktrees) {
      continue;
    }

    for (const worktree of inspection.worktrees) {
      roots.push(worktree.path);
    }
  }

  return roots;
}

function getSelection(
  currentContext: SelectedThreadContext | null,
  selectionState: Pick<SelectionState, "get">,
): AppSelectionState {
  if (!currentContext) {
    return selectionState.get();
  }

  return {
    repositoryId: currentContext.repositoryId,
    worktreeId: currentContext.worktreePath,
    threadId: currentContext.thread.id,
  };
}

export function createShellStateIpcDependencies(
  deps: CreateShellStateIpcDependencies,
) {
  const createShellSnapshot =
    deps.createShellSnapshot ?? createShellSnapshotDefault;

  async function getShellSnapshot(): Promise<ShellSnapshot> {
    const currentContext = deps.getCurrentContext();
    const agentSnapshot = await getAgentSnapshot(deps.getCurrentHost());
    const selection = getSelection(currentContext, deps.selectionState);
    const catalog = await buildShellCatalog({
      repositories: deps.repositoryCatalog.list(),
      selection,
      repositoryPreferences: deps.repositoryPreferencesCatalog.list(),
      workspaceSessions: deps.workspaceSessionCatalog.list(),
      inspectRepository: (rootPath) => deps.gitService.inspectAsync(rootPath),
      listThreadsByWorktree: (worktreeId) =>
        deps.threadCatalog.listByWorktree(worktreeId),
      getRuntimeState: (thread) => deps.runtimeManager.getRuntimeState(thread),
      selectedAgentSnapshot: agentSnapshot,
    });

    deps.selectionState.replace(catalog.selection);
    deps.workspaceSessionCatalog.replaceAll(
      catalog.reconciledWorkspaceSessions ?? [],
    );

    return createShellSnapshot({
      appName: deps.appName,
      appVersion: deps.appVersion,
      chromeVersion: deps.chromeVersion,
      electronVersion: deps.electronVersion,
      platform: deps.platform,
      env: deps.env,
      isPackaged: deps.isPackaged,
      cwd:
        selection.worktreeId ??
        selection.repositoryId ??
        deps.preferredWorkspacePath,
      agentDir: currentContext?.agentDirectory ?? undefined,
      agentMode: currentContext?.agentMode,
      agentSnapshot,
      catalog,
    });
  }

  function getWorkspaceRootPath(): string | null {
    return (
      deps.getCurrentContext()?.worktreePath ??
      deps.selectionState.get().worktreeId
    );
  }

  function getAllowedRepositoryRoots(): string[] {
    return [...new Set(listAllowedWorkspacePaths(deps))];
  }

  function getAllowedTerminalCwds(): string[] {
    return listAllowedWorkspacePaths(deps);
  }

  return {
    getShellSnapshot,
    getWorkspaceRootPath,
    getAllowedRepositoryRoots,
    getAllowedTerminalCwds,
  };
}
