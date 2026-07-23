import { IPC_CHANNELS } from "@pi-desktop/shared";
import { Schema } from "effect";
import { createIpcContract } from "../contract-runtime.js";

const WorktreeCreateRequestSchema = Schema.Struct({
  repositoryId: Schema.String,
  branchName: Schema.String,
});

const WorktreeIdRequestSchema = Schema.Struct({
  worktreeId: Schema.String,
});

const VoidResponseSchema = Schema.Void;

export const worktreeContracts = {
  create: createIpcContract({
    channel: IPC_CHANNELS.worktrees.create,
    request: WorktreeCreateRequestSchema,
    response: VoidResponseSchema,
  }),
  select: createIpcContract({
    channel: IPC_CHANNELS.worktrees.select,
    request: WorktreeIdRequestSchema,
    response: VoidResponseSchema,
  }),
  remove: createIpcContract({
    channel: IPC_CHANNELS.worktrees.remove,
    request: WorktreeIdRequestSchema,
    response: VoidResponseSchema,
  }),
} as const;
