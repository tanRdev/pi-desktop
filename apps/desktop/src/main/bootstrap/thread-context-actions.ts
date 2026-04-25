import path from "node:path";
import type { ThreadCatalogEntry } from "../thread-catalog";
import type { ThreadRuntimeLaunchSpec } from "../thread-runtime-manager";
import type {
  ResolvedRepositoryInspection,
  SelectedThreadContext,
} from "./thread-context";

type ThreadEntry = Pick<ThreadCatalogEntry, "id" | "worktreeId">;

type RepositoryEntry = {
  id: string;
  rootPath: string;
};

type RuntimeOptions = {
  mode: SelectedThreadContext["agentMode"];
  cwd: string;
  agentDir?: string | null;
};

type LaunchDetails = {
  socketPath: string;
  runtimeId?: string;
  agentDirectory?: string;
  command: string[];
};

type WorkspaceActivationOptions = {
  createIfMissing?: boolean;
};

type Attachment<TContext, THost, TTransport extends { close(): void }> = {
  context: TContext;
  host: THost;
  transport: TTransport;
};

type CreateThreadContextActionsDependencies<
  THost extends object,
  TTransport extends { close(): void },
  TThread extends ThreadEntry,
> = {
  inspectWorktreeOrThrow(targetPath: string): ResolvedRepositoryInspection;
  upsertRepository(input: { rootPath: string }): RepositoryEntry;
  getRepository(repositoryId: string): RepositoryEntry | null;
  setLastSelectedWorktree(repositoryId: string, worktreeId: string): void;
  replaceSelection(selection: {
    repositoryId: string;
    worktreeId: string;
    threadId: string | null;
  }): void;
  listThreadsByWorktree(worktreeId: string): TThread[];
  createThread(input: { worktreeId: string; title: string }): TThread;
  getDefaultThreadTitle(): string;
  buildThreadContext(
    repositoryId: string,
    inspection: ResolvedRepositoryInspection,
    thread: TThread,
  ): SelectedThreadContext<TThread>;
  environment: NodeJS.ProcessEnv;
  runtimeSocketDirectory: string;
  execPath: string;
  sessionServerEntryPath: string;
  ensureDirectory(directory: string, options: { recursive: true }): void;
  resolveRuntimeOptions(
    environment: NodeJS.ProcessEnv,
    cwd: string,
  ): RuntimeOptions;
  createLaunchDetails(input: {
    threadId: string;
    worktreePath: string;
    mode: SelectedThreadContext["agentMode"];
    socketDirectory: string;
    execPath: string;
    sessionServerEntryPath: string;
    nodeEnv: string | undefined;
    agentDirectory?: string | null;
  }): LaunchDetails;
  getHomePath(): string;
  isRepository(rootPath: string): boolean;
  createWorktree(input: {
    repositoryRoot: string;
    branchName: string;
    worktreePath: string;
    baseBranch?: string;
  }): string;
  ensureThreadRuntime(spec: ThreadRuntimeLaunchSpec): Promise<unknown>;
  restartThreadRuntime(spec: ThreadRuntimeLaunchSpec): Promise<unknown>;
  connectAgentHost(
    socketPath: string,
  ): Promise<{ host: THost; transport: TTransport }>;
};

function createLaunchSpec<TThread extends ThreadEntry>(
  context: SelectedThreadContext<TThread>,
): ThreadRuntimeLaunchSpec {
  return {
    threadId: context.thread.id,
    worktreePath: context.worktreePath,
    command: context.command,
  };
}

export function createThreadContextActions<
  THost extends object,
  TTransport extends { close(): void },
  TThread extends ThreadEntry = ThreadCatalogEntry,
>(deps: CreateThreadContextActionsDependencies<THost, TTransport, TThread>) {
  async function resolveDefaultThreadContext(
    targetPath: string,
    options: WorkspaceActivationOptions = {},
  ): Promise<SelectedThreadContext<TThread> | null> {
    const inspection = deps.inspectWorktreeOrThrow(targetPath);
    const repositoryEntry = deps.upsertRepository({
      rootPath: inspection.rootPath,
    });
    const thread = deps.listThreadsByWorktree(
      inspection.currentWorktreePath,
    )[0];

    if (!thread && options.createIfMissing === false) {
      deps.setLastSelectedWorktree(
        repositoryEntry.id,
        inspection.currentWorktreePath,
      );
      deps.replaceSelection({
        repositoryId: repositoryEntry.id,
        worktreeId: inspection.currentWorktreePath,
        threadId: null,
      });
      return null;
    }

    const resolvedThread =
      thread ??
      deps.createThread({
        worktreeId: inspection.currentWorktreePath,
        title: deps.getDefaultThreadTitle(),
      });

    return deps.buildThreadContext(
      repositoryEntry.id,
      inspection,
      resolvedThread,
    );
  }

  async function createWorktreeContext(
    repositoryId: string,
    branchName: string,
  ): Promise<SelectedThreadContext<TThread> | null> {
    const repository = deps.getRepository(repositoryId);
    if (!repository) {
      throw new Error(`Unknown repository: ${repositoryId}`);
    }

    const inspection = deps.inspectWorktreeOrThrow(repository.rootPath);
    if (!deps.isRepository(repository.rootPath)) {
      throw new Error(
        `"${path.basename(repository.rootPath)}" is not a git repository. Initialize git to create a session.`,
      );
    }

    const trimmedBranchName = branchName.trim();
    if (!trimmedBranchName) {
      throw new Error("Worktree branch name must not be empty");
    }

    const worktreePath = path.join(
      deps.getHomePath(),
      ".pi-desktop",
      path.basename(repository.rootPath),
      trimmedBranchName.replace(/[\\/]+/g, "-"),
    );
    const createdWorktreePath = deps.createWorktree({
      repositoryRoot: repository.rootPath,
      branchName: trimmedBranchName,
      worktreePath,
      baseBranch: inspection.defaultBranch ?? undefined,
    });

    return resolveDefaultThreadContext(createdWorktreePath);
  }

  function buildFastThreadContext(options: {
    repositoryId: string;
    worktreePath: string;
    thread: TThread;
  }): SelectedThreadContext<TThread> {
    const runtimeOptions = deps.resolveRuntimeOptions(
      deps.environment,
      options.worktreePath,
    );

    if (runtimeOptions.agentDir) {
      deps.ensureDirectory(runtimeOptions.agentDir, { recursive: true });
    }

    const launch = deps.createLaunchDetails({
      threadId: options.thread.id,
      worktreePath: options.worktreePath,
      mode: runtimeOptions.mode,
      socketDirectory: deps.runtimeSocketDirectory,
      execPath: deps.execPath,
      sessionServerEntryPath: deps.sessionServerEntryPath,
      nodeEnv: deps.environment.NODE_ENV,
      agentDirectory: runtimeOptions.agentDir ?? undefined,
    });

    deps.setLastSelectedWorktree(options.repositoryId, options.worktreePath);
    deps.replaceSelection({
      repositoryId: options.repositoryId,
      worktreeId: options.worktreePath,
      threadId: options.thread.id,
    });

    return {
      repositoryId: options.repositoryId,
      worktreePath: options.worktreePath,
      thread: options.thread,
      socketPath: launch.socketPath,
      runtimeId: launch.runtimeId ?? null,
      command: launch.command,
      agentMode: runtimeOptions.mode,
      agentDirectory: runtimeOptions.agentDir ?? null,
      runtimeAgentDirectory: launch.agentDirectory ?? null,
    };
  }

  async function attachContext(
    context: SelectedThreadContext<TThread>,
  ): Promise<Attachment<SelectedThreadContext<TThread>, THost, TTransport>> {
    const launchSpec = createLaunchSpec(context);

    await deps.ensureThreadRuntime(launchSpec);

    try {
      const { host, transport } = await deps.connectAgentHost(
        context.socketPath,
      );
      return { context, host, transport };
    } catch {
      await deps.restartThreadRuntime(launchSpec);
      const { host, transport } = await deps.connectAgentHost(
        context.socketPath,
      );
      return { context, host, transport };
    }
  }

  async function attachToPath(
    targetPath: string,
    options: WorkspaceActivationOptions = {},
  ): Promise<Attachment<
    SelectedThreadContext<TThread>,
    THost,
    TTransport
  > | null> {
    const context = await resolveDefaultThreadContext(targetPath, options);
    if (!context) {
      return null;
    }

    return attachContext(context);
  }

  return {
    resolveDefaultThreadContext,
    createWorktreeContext,
    buildFastThreadContext,
    attachContext,
    attachToPath,
  };
}
