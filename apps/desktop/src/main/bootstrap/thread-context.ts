import type { GitRepositoryInspection } from "../git-worktree-service";
import type { ThreadCatalogEntry } from "../thread-catalog";

export type SelectedThreadContext<
  TThread extends { id: string } = ThreadCatalogEntry,
> = {
  repositoryId: string;
  worktreePath: string;
  thread: TThread;
  socketPath: string;
  runtimeId: string | null;
  command: string[];
  agentMode: "mock" | "sdk" | "cli";
  agentDirectory: string | null;
};

export type ResolvedRepositoryInspection = Pick<
  GitRepositoryInspection,
  "rootPath" | "currentWorktreePath" | "worktrees" | "defaultBranch"
> & {
  rootPath: string;
  currentWorktreePath: string;
  worktrees: NonNullable<GitRepositoryInspection["worktrees"]>;
};

type RuntimeOptions = {
  mode: "mock" | "sdk" | "cli";
  cwd: string;
  agentDir: string | null | undefined;
};

type LaunchDetails = {
  socketPath: string;
  runtimeId?: string;
  command: string[];
};

type BuildThreadContextOptions<TThread extends { id: string }> = {
  repositoryId: string;
  inspection: ResolvedRepositoryInspection;
  thread: TThread;
  environment: NodeJS.ProcessEnv;
  runtimeSocketDirectory: string;
  execPath: string;
  sessionServerEntryPath: string;
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
  ensureDirectory(path: string, options: { recursive: true }): void;
  resolveRuntimeOptions(
    environment: NodeJS.ProcessEnv,
    cwd: string,
  ): RuntimeOptions;
  createLaunchDetails(input: {
    threadId: string;
    worktreePath: string;
    mode: "mock" | "sdk" | "cli";
    socketDirectory: string;
    execPath: string;
    sessionServerEntryPath: string;
    nodeEnv: string | undefined;
    agentDirectory?: string | null;
  }): LaunchDetails;
};

export function buildThreadContext<TThread extends { id: string }>(
  options: BuildThreadContextOptions<TThread>,
): SelectedThreadContext<TThread> {
  const {
    repositoryId,
    inspection,
    thread,
    environment,
    runtimeSocketDirectory,
    execPath,
    sessionServerEntryPath,
    repositoryCatalog,
    selectionState,
    ensureDirectory,
    resolveRuntimeOptions,
    createLaunchDetails,
  } = options;

  repositoryCatalog.setLastSelectedWorktree(
    repositoryId,
    inspection.currentWorktreePath,
  );
  selectionState.replace({
    repositoryId,
    worktreeId: inspection.currentWorktreePath,
    threadId: thread.id,
  });

  const runtimeOptions = resolveRuntimeOptions(
    environment,
    inspection.currentWorktreePath,
  );

  if (runtimeOptions.agentDir) {
    ensureDirectory(runtimeOptions.agentDir, { recursive: true });
  }

  const launch = createLaunchDetails({
    threadId: thread.id,
    worktreePath: inspection.currentWorktreePath,
    mode: runtimeOptions.mode,
    socketDirectory: runtimeSocketDirectory,
    execPath,
    sessionServerEntryPath,
    nodeEnv: environment.NODE_ENV,
    agentDirectory: runtimeOptions.agentDir,
  });

  return {
    repositoryId,
    worktreePath: inspection.currentWorktreePath,
    thread,
    socketPath: launch.socketPath,
    runtimeId: launch.runtimeId ?? null,
    command: launch.command,
    agentMode: runtimeOptions.mode,
    agentDirectory: runtimeOptions.agentDir ?? null,
  };
}
