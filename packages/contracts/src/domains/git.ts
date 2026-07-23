import type { GitFileDiff, GitRepositoryStatus } from "@pi-desktop/shared";
import { Schema } from "effect";
import { IPC_CHANNELS } from "../channels.js";

import { createIpcContract } from "../contract-runtime.js";
import { ipcStringSchema, mutableArray } from "./schema-primitives.js";

/** Mirrors git handler commit cap — generous but blocks DOS-by-payload. */
export const MAX_COMMIT_MESSAGE_BYTES = 100 * 1024;

const repositoryPathSchema = ipcStringSchema().pipe(
  Schema.filter((value) => !value.includes("\0"), {
    message: () => "path must not contain null bytes",
  }),
);

export const GitRepositoryPathRequestSchema = Schema.Struct({
  repositoryPath: repositoryPathSchema,
});

export const GitGetRepositoryStatusRequestSchema = Schema.Struct({
  repositoryPath: repositoryPathSchema,
  force: Schema.optional(Schema.Boolean),
});

export const GitFilePathRequestSchema = Schema.Struct({
  repositoryPath: repositoryPathSchema,
  filePath: ipcStringSchema(),
});

export const GitFilePathsRequestSchema = Schema.Struct({
  repositoryPath: repositoryPathSchema,
  filePaths: Schema.Array(ipcStringSchema()).pipe(
    Schema.filter((filePaths) => filePaths.length > 0, {
      message: () => 'field "filePaths" must be a non-empty array of strings',
    }),
  ),
});

export const GitDiffFileRequestSchema = Schema.Struct({
  repositoryPath: repositoryPathSchema,
  filePath: ipcStringSchema(),
  staged: Schema.Boolean,
});

export const GitCommitRequestSchema = Schema.Struct({
  repositoryPath: repositoryPathSchema,
  message: ipcStringSchema(MAX_COMMIT_MESSAGE_BYTES),
});

const GitFileChangeStatusSchema = Schema.Literal(
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "type_changed",
  "unmerged",
  "untracked",
  "unknown",
);

const GitFileChangeSchema = Schema.Struct({
  path: Schema.String,
  status: GitFileChangeStatusSchema,
  indexStatus: Schema.NullOr(GitFileChangeStatusSchema),
  worktreeStatus: Schema.NullOr(GitFileChangeStatusSchema),
});

const WorktreeGitStatusSchema = Schema.Literal(
  "ready",
  "missing",
  "unavailable",
);

const WorktreeGitSnapshotSchema = Schema.Struct({
  status: WorktreeGitStatusSchema,
  branch: Schema.NullOr(Schema.String),
  commit: Schema.NullOr(Schema.String),
  hasChanges: Schema.Boolean,
  ahead: Schema.NullOr(Schema.Number),
  behind: Schema.NullOr(Schema.Number),
  stagedCount: Schema.Number,
  modifiedCount: Schema.Number,
  untrackedCount: Schema.Number,
  message: Schema.NullOr(Schema.String),
  prStatus: Schema.optional(
    Schema.NullOr(Schema.Literal("merged", "open", "closed")),
  ),
});

export const GitRepositoryStatusSchema = Schema.Struct({
  repositoryPath: Schema.String,
  branch: Schema.NullOr(Schema.String),
  commit: Schema.NullOr(Schema.String),
  upstreamBranch: Schema.NullOr(Schema.String),
  summary: WorktreeGitSnapshotSchema,
  stagedChanges: mutableArray(GitFileChangeSchema),
  unstagedChanges: mutableArray(GitFileChangeSchema),
  conflictedChanges: mutableArray(GitFileChangeSchema),
}) satisfies Schema.Schema<GitRepositoryStatus>;

const GitDiffLineTypeSchema = Schema.Literal(
  "add",
  "remove",
  "context",
  "hunk_header",
);

const GitDiffLineSchema = Schema.Struct({
  type: GitDiffLineTypeSchema,
  content: Schema.String,
  oldLineNumber: Schema.NullOr(Schema.Number),
  newLineNumber: Schema.NullOr(Schema.Number),
});

const GitDiffHunkSchema = Schema.Struct({
  oldStart: Schema.Number,
  oldCount: Schema.Number,
  newStart: Schema.Number,
  newCount: Schema.Number,
  lines: mutableArray(GitDiffLineSchema),
});

export const GitFileDiffSchema = Schema.Struct({
  filePath: Schema.String,
  oldFilePath: Schema.NullOr(Schema.String),
  status: GitFileChangeStatusSchema,
  hunks: mutableArray(GitDiffHunkSchema),
  binary: Schema.Boolean,
}) satisfies Schema.Schema<GitFileDiff>;

function createRepositoryStatusContract<TRequest>(
  channel: string,
  request: Schema.Schema<TRequest>,
) {
  return createIpcContract({
    channel,
    request,
    response: GitRepositoryStatusSchema,
  });
}

function createRepositoryPathStatusContract(channel: string) {
  return createRepositoryStatusContract(
    channel,
    GitRepositoryPathRequestSchema,
  );
}

export const gitContracts = {
  getRepositoryStatus: createIpcContract({
    channel: IPC_CHANNELS.git.getRepositoryStatus,
    request: GitGetRepositoryStatusRequestSchema,
    response: GitRepositoryStatusSchema,
  }),
  isRepository: createIpcContract({
    channel: IPC_CHANNELS.git.isRepository,
    request: GitRepositoryPathRequestSchema,
    response: Schema.Boolean,
  }),
  init: createIpcContract({
    channel: IPC_CHANNELS.git.init,
    request: GitRepositoryPathRequestSchema,
    response: Schema.Void,
  }),
  stageFile: createIpcContract({
    channel: IPC_CHANNELS.git.stageFile,
    request: GitFilePathRequestSchema,
    response: GitRepositoryStatusSchema,
  }),
  stageFiles: createIpcContract({
    channel: IPC_CHANNELS.git.stageFiles,
    request: GitFilePathsRequestSchema,
    response: GitRepositoryStatusSchema,
  }),
  unstageFile: createIpcContract({
    channel: IPC_CHANNELS.git.unstageFile,
    request: GitFilePathRequestSchema,
    response: GitRepositoryStatusSchema,
  }),
  unstageFiles: createIpcContract({
    channel: IPC_CHANNELS.git.unstageFiles,
    request: GitFilePathsRequestSchema,
    response: GitRepositoryStatusSchema,
  }),
  discardFile: createIpcContract({
    channel: IPC_CHANNELS.git.discardFile,
    request: GitFilePathRequestSchema,
    response: GitRepositoryStatusSchema,
  }),
  commit: createIpcContract({
    channel: IPC_CHANNELS.git.commit,
    request: GitCommitRequestSchema,
    response: GitRepositoryStatusSchema,
  }),
  pull: createRepositoryPathStatusContract(IPC_CHANNELS.git.pull),
  push: createRepositoryPathStatusContract(IPC_CHANNELS.git.push),
  fetch: createRepositoryPathStatusContract(IPC_CHANNELS.git.fetch),
  diffFile: createIpcContract({
    channel: IPC_CHANNELS.git.diffFile,
    request: GitDiffFileRequestSchema,
    response: GitFileDiffSchema,
  }),
} as const;

type AssignableTo<Decoded, Target> = Decoded extends Target ? true : never;

type _GitRepositoryStatusAssignable = AssignableTo<
  Schema.Schema.Type<typeof GitRepositoryStatusSchema>,
  GitRepositoryStatus
>;
type _GitFileDiffAssignable = AssignableTo<
  Schema.Schema.Type<typeof GitFileDiffSchema>,
  GitFileDiff
>;

export type GitSchemasAssignable =
  | _GitRepositoryStatusAssignable
  | _GitFileDiffAssignable;

export const gitContractList = [
  gitContracts.getRepositoryStatus,
  gitContracts.isRepository,
  gitContracts.init,
  gitContracts.stageFile,
  gitContracts.stageFiles,
  gitContracts.unstageFile,
  gitContracts.unstageFiles,
  gitContracts.discardFile,
  gitContracts.commit,
  gitContracts.pull,
  gitContracts.push,
  gitContracts.fetch,
  gitContracts.diffFile,
] as const;
