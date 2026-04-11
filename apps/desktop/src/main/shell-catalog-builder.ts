import path from "node:path";
import {
  type AgentSnapshot,
  createEmptyWorkspaceSession,
  isFileBackedWindow,
  type RepositoryPreferences,
  type ShellCatalogSnapshot,
  type TerminalWindow,
  type ThreadSnapshot,
  type WorkspaceSession,
} from "@pidesk/shared";
import type {
  GitRepositoryInspection,
  GitWorktreeSummary,
} from "./git-worktree-service";
import type { RepositoryCatalogEntry } from "./repository-catalog";
import type { AppSelectionState } from "./selection-state";
import type { ThreadCatalogEntry } from "./thread-catalog";
import type { ThreadRuntimeRef } from "./thread-runtime-manager";

export interface BuildShellCatalogOptions {
  repositories: RepositoryCatalogEntry[];
  selection: AppSelectionState;
  repositoryPreferences?: RepositoryPreferences[];
  workspaceSessions?: WorkspaceSession[];
  inspectRepository: (rootPath: string) => GitRepositoryInspection;
  listThreadsByWorktree: (worktreeId: string) => ThreadCatalogEntry[];
  getRuntimeState: (thread: ThreadRuntimeRef) => Promise<{
    status: ThreadSnapshot["runtime"]["status"];
    lastError: string | null;
  }>;
  selectedAgentSnapshot?: AgentSnapshot | null;
}

type ThreadLookup = Map<string, Set<string>>;

function isWithinWorktree(worktreeId: string, targetPath: string): boolean {
  const normalizedTargetPath = path.resolve(targetPath);
  return (
    normalizedTargetPath === worktreeId ||
    normalizedTargetPath.startsWith(`${worktreeId}${path.sep}`)
  );
}

function indexThreadsByWorktree(
  repositories: ShellCatalogSnapshot["repositories"],
): ThreadLookup {
  const index: ThreadLookup = new Map();

  for (const repository of repositories) {
    for (const worktree of repository.worktrees) {
      index.set(
        worktree.id,
        new Set(
          worktree.threads
            .filter((thread) => thread.isArchived === false)
            .map((thread) => thread.id),
        ),
      );
    }
  }

  return index;
}

function reconcileWorkspaceSessions(
  repositories: ShellCatalogSnapshot["repositories"],
  workspaceSessions: WorkspaceSession[],
): WorkspaceSession[] {
  const worktreeIds = new Set(
    repositories.flatMap((repository) =>
      repository.worktrees.map((worktree) => worktree.id),
    ),
  );
  const threadIdsByWorktree = indexThreadsByWorktree(repositories);

  return workspaceSessions.flatMap((session) => {
    if (!worktreeIds.has(session.worktreeId)) {
      return [];
    }

    const validThreadIds =
      threadIdsByWorktree.get(session.worktreeId) ?? new Set();
    const candidateWindows = session.layout.windows.filter((window) => {
      if (window.kind === "chat") {
        return validThreadIds.has(window.threadId);
      }

      if (isFileBackedWindow(window)) {
        return isWithinWorktree(session.worktreeId, window.filePath);
      }

      return true;
    });
    const validWindows = candidateWindows.map((window) => {
      if (window.kind === "terminal") {
        const normalizedBackend =
          window.backend === "pi" ? ("pi" as const) : ("shell" as const);

        const normalizedWindow: TerminalWindow = {
          id: window.id,
          kind: window.kind,
          title: window.title,
          x: window.x,
          y: window.y,
          width: window.width,
          height: window.height,
          zIndex: window.zIndex,
          isFocused: window.isFocused,
          state: window.state,
          ...(window.linkColor ? { linkColor: window.linkColor } : {}),
          ...(window.linkTargetIds
            ? { linkTargetIds: window.linkTargetIds }
            : {}),
          terminalId: window.terminalId,
          backend: normalizedBackend,
          cwd: isWithinWorktree(session.worktreeId, window.cwd)
            ? window.cwd
            : session.worktreeId,
        };

        return normalizedWindow;
      }

      if (window.kind === "git") {
        return {
          ...window,
          repositoryPath: isWithinWorktree(
            session.worktreeId,
            window.repositoryPath,
          )
            ? window.repositoryPath
            : session.worktreeId,
        };
      }

      return window;
    });
    const validWindowIds = new Set(validWindows.map((window) => window.id));
    const focusedWindowId =
      session.layout.focusedWindowId &&
      validWindowIds.has(session.layout.focusedWindowId)
        ? session.layout.focusedWindowId
        : (validWindows.findLast((window) => window.kind === "chat")?.id ??
          validWindows[0]?.id ??
          null);
    const promptDrafts = Object.fromEntries(
      Object.entries(session.promptDrafts).filter(([threadId]) =>
        validThreadIds.has(threadId),
      ),
    );
    const recoveryDrafts = Object.fromEntries(
      Object.entries(session.recoveryDrafts).filter(([draftId, draft]) =>
        draft.kind === "note" ? true : validThreadIds.has(draftId),
      ),
    );
    const files = Object.fromEntries(
      Object.entries(session.files).filter(([filePath]) =>
        isWithinWorktree(session.worktreeId, filePath),
      ),
    );
    const selectedPath =
      session.search.selectedPath &&
      isWithinWorktree(session.worktreeId, session.search.selectedPath)
        ? session.search.selectedPath
        : null;

    return [
      {
        ...createEmptyWorkspaceSession(session.worktreeId),
        ...session,
        promptDrafts,
        recoveryDrafts,
        files,
        search: {
          ...session.search,
          selectedPath,
        },
        layout: {
          ...session.layout,
          windows: validWindows,
          focusedWindowId,
          nextZIndex: Math.max(
            session.layout.nextZIndex,
            session.layout.windows.reduce(
              (maxZIndex, window) => Math.max(maxZIndex, window.zIndex),
              0,
            ) + 1,
          ),
        },
      },
    ];
  });
}

function createWorktreeLabel(
  worktree: GitWorktreeSummary,
  fallbackName: string,
): string {
  if (worktree.branch) {
    return worktree.branch;
  }

  if (worktree.isDetached) {
    return `Detached ${worktree.commit ?? ""}`.trim();
  }

  return path.basename(worktree.path) || fallbackName;
}

function reconcileSelection(
  repositories: ShellCatalogSnapshot["repositories"],
  selection: AppSelectionState,
): AppSelectionState {
  const repositoriesWithWorktrees = repositories.filter(
    (repository) => repository.worktrees.length > 0,
  );
  const repository =
    repositoriesWithWorktrees.find(
      (item) => item.id === selection.repositoryId,
    ) ??
    repositoriesWithWorktrees[0] ??
    null;
  const worktree = repository
    ? (repository.worktrees.find((item) => item.id === selection.worktreeId) ??
      repository.worktrees[0] ??
      null)
    : null;
  const thread = worktree
    ? (worktree.threads.find((item) => item.id === selection.threadId) ??
      worktree.threads.find((item) => item.isArchived === false) ??
      null)
    : null;

  return {
    repositoryId: repository?.id ?? null,
    worktreeId: worktree?.id ?? null,
    threadId: thread?.id ?? null,
  };
}

async function createThreadSnapshot(
  thread: ThreadCatalogEntry,
  worktreePath: string,
  getRuntimeState: BuildShellCatalogOptions["getRuntimeState"],
  selectedThreadId: string | null,
  selectedAgentSnapshot?: AgentSnapshot | null,
): Promise<ThreadSnapshot> {
  const runtimeState =
    thread.id === selectedThreadId && selectedAgentSnapshot
      ? {
          status: selectedAgentSnapshot.status,
          lastError: selectedAgentSnapshot.lastError,
        }
      : await getRuntimeState({
          threadId: thread.id,
          worktreePath,
        });

  return {
    id: thread.id,
    title: thread.title,
    isArchived: thread.archivedAt !== null,
    lastActivityAt: thread.lastActivityAt,
    runtime: {
      status: runtimeState.status,
      lastError: runtimeState.lastError,
    },
  };
}

export async function buildShellCatalog({
  repositories,
  selection,
  repositoryPreferences = [],
  workspaceSessions = [],
  inspectRepository,
  listThreadsByWorktree,
  getRuntimeState,
  selectedAgentSnapshot,
}: BuildShellCatalogOptions): Promise<ShellCatalogSnapshot> {
  const repositorySnapshots = await Promise.all(
    repositories.map(async (repository) => {
      const preferences =
        repositoryPreferences.find(
          (entry) => entry.repositoryId === repository.id,
        ) ?? null;
      const inspection = inspectRepository(repository.rootPath);
      const fallbackName =
        preferences?.customName ??
        repository.label ??
        path.basename(repository.rootPath);

      if (
        inspection.status !== "repository" ||
        !inspection.rootPath ||
        !inspection.worktrees
      ) {
        return {
          id: repository.id,
          order: repository.order,
          name: fallbackName,
          customName: preferences?.customName ?? null,
          icon: preferences?.icon ?? null,
          accentColor: preferences?.accentColor ?? null,
          rootPath: repository.rootPath,
          defaultBranch: null,
          worktrees: [],
        };
      }

      const worktrees = await Promise.all(
        inspection.worktrees.map(async (worktree) => ({
          id: worktree.path,
          label: createWorktreeLabel(worktree, fallbackName),
          path: worktree.path,
          isMain: worktree.isMain,
          isDetached: worktree.isDetached,
          git: worktree.git,
          threads: await Promise.all(
            listThreadsByWorktree(worktree.path).map((thread) =>
              createThreadSnapshot(
                thread,
                worktree.path,
                getRuntimeState,
                selection.threadId,
                selectedAgentSnapshot,
              ),
            ),
          ),
        })),
      );

      return {
        id: repository.id,
        order: repository.order,
        name: fallbackName,
        customName: preferences?.customName ?? null,
        icon: preferences?.icon ?? null,
        accentColor: preferences?.accentColor ?? null,
        rootPath: repository.rootPath,
        defaultBranch: inspection.defaultBranch ?? null,
        worktrees,
      };
    }),
  );

  return {
    repositories: repositorySnapshots,
    selection: reconcileSelection(repositorySnapshots, selection),
    reconciledWorkspaceSessions: reconcileWorkspaceSessions(
      repositorySnapshots,
      workspaceSessions,
    ),
  };
}
