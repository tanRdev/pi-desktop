import type { GitRepositoryInspection } from "../git-worktree-service";
import type { ThreadCatalogEntry } from "../thread-catalog";

export type ResolvedRepositoryInspection = GitRepositoryInspection & {
  status: "repository";
  rootPath: string;
  currentWorktreePath: string;
  worktrees: NonNullable<GitRepositoryInspection["worktrees"]>;
};

export type SelectedThreadContext = {
  repositoryId: string;
  worktreePath: string;
  thread: ThreadCatalogEntry;
  socketPath: string;
  sessionName: string;
  command: string[];
  agentMode: "mock" | "sdk";
  agentDirectory: string | null;
};

export async function buildThreadContext(options: {
  repositoryId: string;
  inspection: ResolvedRepositoryInspection;
  thread: ThreadCatalogEntry;
  repositoryCatalog: {
    setLastSelectedWorktree(repositoryId: string, worktreeId: string): void;
  };
  selectionState: {
    replace(selection: {
      repositoryId: string;
      worktreeId: string;
      threadId: string;
    }): void;
  };
  resolveAgentRuntimeOptions(
    env: NodeJS.ProcessEnv,
    worktreePath: string,
  ): { mode: "mock" | "sdk"; agentDir?: string | null };
  runtimeSocketDirectory: string;
  execPath: string;
  sessionServerEntryPath: string;
  env: NodeJS.ProcessEnv;
  createThreadRuntimeLaunchDetails(args: {
    threadId: string;
    worktreePath: string;
    mode: "mock" | "sdk";
    socketDirectory: string;
    execPath: string;
    sessionServerEntryPath: string;
    nodeEnv?: string;
    agentDirectory?: string | null;
  }): { socketPath: string; sessionName: string; command: string[] };
  mkdirSync?: (path: string, options: { recursive: true }) => void;
}) {
  const { repositoryId, inspection, thread } = options;

  options.repositoryCatalog.setLastSelectedWorktree(
    repositoryId,
    inspection.currentWorktreePath,
  );
  options.selectionState.replace({
    repositoryId,
    worktreeId: inspection.currentWorktreePath,
    threadId: thread.id,
  });

  const runtimeOptions = options.resolveAgentRuntimeOptions(
    options.env,
    inspection.currentWorktreePath,
  );
  if (runtimeOptions.agentDir) {
    const mkdir =
      options.mkdirSync ??
      ((p: string) => {
        /* noop in tests if not provided */
      });
    mkdir(runtimeOptions.agentDir, { recursive: true });
  }

  const launch = options.createThreadRuntimeLaunchDetails({
    threadId: thread.id,
    worktreePath: inspection.currentWorktreePath,
    mode: runtimeOptions.mode,
    socketDirectory: options.runtimeSocketDirectory,
    execPath: options.execPath,
    sessionServerEntryPath: options.sessionServerEntryPath,
    nodeEnv: options.env.NODE_ENV,
    agentDirectory: runtimeOptions.agentDir,
  });

  return {
    repositoryId,
    worktreePath: inspection.currentWorktreePath,
    thread,
    socketPath: launch.socketPath,
    sessionName: launch.sessionName,
    command: launch.command,
    agentMode: runtimeOptions.mode,
    agentDirectory: runtimeOptions.agentDir ?? null,
  } as SelectedThreadContext;
}
