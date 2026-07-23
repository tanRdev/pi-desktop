import { IPC_CHANNELS } from "@pi-desktop/shared";
import { Schema } from "effect";
import { createIpcContract } from "../contract-runtime.js";

const RepositoryPathRequestSchema = Schema.Struct({
  path: Schema.String,
});

const RepositoryIdRequestSchema = Schema.Struct({
  repositoryId: Schema.String,
});

const RepositoryReorderRequestSchema = Schema.Struct({
  repositoryIds: Schema.Array(Schema.String).pipe(
    Schema.filter((repositoryIds) => repositoryIds.length > 0, {
      message: () => "repositoryIds must be a non-empty string array",
    }),
  ),
});

const VoidResponseSchema = Schema.Void;

export const repositoryContracts = {
  add: createIpcContract({
    channel: IPC_CHANNELS.repositories.add,
    request: RepositoryPathRequestSchema,
    response: VoidResponseSchema,
  }),
  reorder: createIpcContract({
    channel: IPC_CHANNELS.repositories.reorder,
    request: RepositoryReorderRequestSchema,
    response: VoidResponseSchema,
  }),
  select: createIpcContract({
    channel: IPC_CHANNELS.repositories.select,
    request: RepositoryIdRequestSchema,
    response: VoidResponseSchema,
  }),
  remove: createIpcContract({
    channel: IPC_CHANNELS.repositories.remove,
    request: RepositoryIdRequestSchema,
    response: VoidResponseSchema,
  }),
  openInFinder: createIpcContract({
    channel: IPC_CHANNELS.repositories.openInFinder,
    request: RepositoryIdRequestSchema,
    response: VoidResponseSchema,
  }),
} as const;
