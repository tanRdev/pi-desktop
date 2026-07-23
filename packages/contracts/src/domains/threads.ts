import { Schema } from "effect";
import { IPC_CHANNELS } from "../channels.js";
import { createIpcContract } from "../contract-runtime.js";

const WorktreeIdRequestSchema = Schema.Struct({
  worktreeId: Schema.String,
});

const ThreadIdRequestSchema = Schema.Struct({
  threadId: Schema.String,
});

const VoidResponseSchema = Schema.Void;

export const threadContracts = {
  create: createIpcContract({
    channel: IPC_CHANNELS.threads.create,
    request: WorktreeIdRequestSchema,
    response: Schema.String,
  }),
  select: createIpcContract({
    channel: IPC_CHANNELS.threads.select,
    request: ThreadIdRequestSchema,
    response: VoidResponseSchema,
  }),
  delete: createIpcContract({
    channel: IPC_CHANNELS.threads.delete,
    request: ThreadIdRequestSchema,
    response: VoidResponseSchema,
  }),
} as const;
