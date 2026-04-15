import os from "node:os";
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
} from "@pi-desktop/shared";
import type {
  GitRepositoryInspection,
  GitWorktreeSummary,
} from "./git-worktree-service";

const PI_DESKTOP_WORKTREES_DIR = path.join(os.homedir(), ".pi-desktop");

function isPiDesktopWorktree(worktreePath: string): boolean {
  const normalized = path.resolve(worktreePath);
  const normalizedBase = path.resolve(PI_DESKTOP_WORKTREES_DIR);
  return (
    normalized.startsWith(normalizedBase + path.sep) ||
    normalized === normalizedBase
  );
}
import type { RepositoryCatalogEntry } from "./repository-catalog";
import type { AppSelectionState } from "./selection-state";
import type { ThreadCatalogEntry } from "./thread-catalog";
import type { ThreadRuntimeRef } from "./thread-runtime-manager";

export interface BuildShellCatalogOptions {
  repositories: RepositoryCatalogEntry[];
  selection: AppSelectionState;
  repositoryPreferences?: RepositoryPreferences[];
  workspaceSessions?: WorkspaceSession[];
  inspectRepository: (
    rootPath: string,
  ) => GitRepositoryInspection | Promise<GitRepositoryInspection>;
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
        new Set(worktree.threads.map((thread) => thread.id)),
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

function createFolderWorkspaceSnapshot(options: {
  rootPath: string;
  fallbackName: string;
  threads: ThreadSnapshot[];
  createdAt?: number;
}): ShellCatalogSnapshot["repositories"][number]["worktrees"][number] {
  const { rootPath, fallbackName, threads, createdAt } = options;

  return {
    id: rootPath,
    label: path.basename(rootPath) || fallbackName,
    path: rootPath,
    isMain: true,
    isDetached: false,
    git: {
      status: "unavailable",
      branch: null,
      commit: null,
      hasChanges: false,
      ahead: null,
      behind: null,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      message: "Git unavailable",
    },
    threads,
    createdAt,
  };
}

function reconcileSelection(
  repositories: ShellCatalogSnapshot["repositories"],
  selection: AppSelectionState,
): AppSelectionState {
  const repository =
    repositories.find((item) => item.id === selection.repositoryId) ??
    repositories.find((item) => item.worktrees.length > 0) ??
    repositories[0] ??
    null;

  if (!repository) {
    return {
      repositoryId: null,
      worktreeId: null,
      threadId: null,
    };
  }

  if (repository.worktrees.length === 0) {
    return {
      repositoryId: repository.id,
      worktreeId: null,
      threadId: null,
    };
  }

  const worktree = repository
    ? (repository.worktrees.find((item) => item.id === selection.worktreeId) ??
      repository.worktrees[0] ??
      null)
    : null;
  const thread = worktree
    ? (worktree.threads.find((item) => item.id === selection.threadId) ??
      worktree.threads[0] ??
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
    lastActivityAt: thread.lastActivityAt,
    createdAt: thread.createdAt,
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
      const inspection = await inspectRepository(repository.rootPath);
      const fallbackName =
        preferences?.customName ??
        repository.label ??
        path.basename(repository.rootPath);

      if (
        inspection.status !== "repository" ||
        !inspection.rootPath ||
        !inspection.worktrees
      ) {
        const folderThreads = await Promise.all(
          listThreadsByWorktree(repository.rootPath).map((thread) =>
            createThreadSnapshot(
              thread,
              repository.rootPath,
              getRuntimeState,
              selection.threadId,
              selectedAgentSnapshot,
            ),
          ),
        );

        const folderCreatedAt = folderThreads.reduce<number | undefined>(
          (oldest, t) =>
            t.createdAt != null
              ? oldest == null
                ? t.createdAt
                : Math.min(oldest, t.createdAt)
              : oldest,
          undefined,
        );

        return {
          id: repository.id,
          order: repository.order,
          name: fallbackName,
          customName: preferences?.customName ?? null,
          icon: preferences?.icon ?? null,
          accentColor: preferences?.accentColor ?? null,
          rootPath: repository.rootPath,
          defaultBranch: null,
          worktrees: [
            createFolderWorkspaceSnapshot({
              rootPath: repository.rootPath,
              fallbackName,
              threads: folderThreads,
              createdAt: folderCreatedAt,
            }),
          ],
        };
      }

      const appWorktrees = inspection.worktrees.filter(
        (worktree) => worktree.isMain || isPiDesktopWorktree(worktree.path),
      );

      const worktrees = await Promise.all(
        appWorktrees.map(async (worktree) => {
          const threads = await Promise.all(
            listThreadsByWorktree(worktree.path).map((thread) =>
              createThreadSnapshot(
                thread,
                worktree.path,
                getRuntimeState,
                selection.threadId,
                selectedAgentSnapshot,
              ),
            ),
          );

          const createdAt = threads.reduce<number | undefined>(
            (oldest, t) =>
              t.createdAt != null
                ? oldest == null
                  ? t.createdAt
                  : Math.min(oldest, t.createdAt)
                : oldest,
            undefined,
          );

          return {
            id: worktree.path,
            label: createWorktreeLabel(worktree, fallbackName),
            path: worktree.path,
            isMain: worktree.isMain,
            isDetached: worktree.isDetached,
            git: worktree.git,
            threads,
            createdAt,
          };
        }),
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
