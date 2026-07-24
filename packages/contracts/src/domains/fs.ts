import type {
  DirectoryListing,
  FileContent,
  FileEntry,
} from "@pi-desktop/shared";
import { Schema } from "effect";
import { IPC_CHANNELS } from "../channels.js";

import { createIpcContract } from "../contract-runtime.js";
import {
  ipcStringSchema,
  MAX_WRITE_FILE_BYTES,
  mutableArray,
} from "./schema-primitives.js";

export const FsReadDirectoryRequestSchema = Schema.Struct({
  path: ipcStringSchema(),
});

export const FsReadFileRequestSchema = Schema.Struct({
  path: ipcStringSchema(),
});

export const FsWriteFileRequestSchema = Schema.Struct({
  path: ipcStringSchema(),
  content: ipcStringSchema(MAX_WRITE_FILE_BYTES),
});

export const FsDeleteFileRequestSchema = Schema.Struct({
  path: ipcStringSchema(),
});

export const FsRenameFileRequestSchema = Schema.Struct({
  oldPath: ipcStringSchema(),
  newPath: ipcStringSchema(),
});

export const FsMoveFileRequestSchema = Schema.Struct({
  sourcePath: ipcStringSchema(),
  destinationPath: ipcStringSchema(),
});

const FileEntrySchema = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
  type: Schema.Literal("file", "directory"),
  extension: Schema.optional(Schema.String),
}) satisfies Schema.Schema<FileEntry>;

const DirectoryListingSchema = Schema.Struct({
  path: Schema.String,
  entries: mutableArray(FileEntrySchema),
}) satisfies Schema.Schema<DirectoryListing>;

const ReadDirectoryFailureSchema = Schema.Struct({
  success: Schema.Literal(false),
  error: Schema.String,
  code: Schema.String,
});

export const FsReadDirectoryResponseSchema = Schema.Union(
  DirectoryListingSchema,
  ReadDirectoryFailureSchema,
);

export const FileContentSchema = Schema.Struct({
  path: Schema.String,
  content: Schema.String,
  type: Schema.Literal("text", "binary", "image", "unsupported"),
  encoding: Schema.optional(Schema.String),
  size: Schema.optional(Schema.Number),
  truncated: Schema.optional(Schema.Boolean),
  mimeType: Schema.optional(Schema.String),
}) satisfies Schema.Schema<FileContent>;

function createVoidResponseContract<TRequest>(
  channel: string,
  request: Schema.Schema<TRequest>,
) {
  return createIpcContract({
    channel,
    request,
    response: Schema.Void,
  });
}

export const fsContracts = {
  readDirectory: createIpcContract({
    channel: IPC_CHANNELS.fs.readDirectory,
    request: FsReadDirectoryRequestSchema,
    response: FsReadDirectoryResponseSchema,
  }),
  readFile: createIpcContract({
    channel: IPC_CHANNELS.fs.readFile,
    request: FsReadFileRequestSchema,
    response: FileContentSchema,
  }),
  writeFile: createVoidResponseContract(
    IPC_CHANNELS.fs.writeFile,
    FsWriteFileRequestSchema,
  ),
  deleteFile: createVoidResponseContract(
    IPC_CHANNELS.fs.deleteFile,
    FsDeleteFileRequestSchema,
  ),
  renameFile: createVoidResponseContract(
    IPC_CHANNELS.fs.renameFile,
    FsRenameFileRequestSchema,
  ),
  moveFile: createVoidResponseContract(
    IPC_CHANNELS.fs.moveFile,
    FsMoveFileRequestSchema,
  ),
} as const;

type AssignableTo<Decoded, Target> = Decoded extends Target ? true : never;

type _DirectoryListingAssignable = AssignableTo<
  Schema.Schema.Type<typeof DirectoryListingSchema>,
  DirectoryListing
>;
type _FileContentAssignable = AssignableTo<
  Schema.Schema.Type<typeof FileContentSchema>,
  FileContent
>;

export type FsSchemasAssignable =
  | _DirectoryListingAssignable
  | _FileContentAssignable;

export const fsContractList = [
  fsContracts.readDirectory,
  fsContracts.readFile,
  fsContracts.writeFile,
  fsContracts.deleteFile,
  fsContracts.renameFile,
  fsContracts.moveFile,
] as const;
