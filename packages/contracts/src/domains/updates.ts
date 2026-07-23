import { Schema } from "effect";
import { IPC_CHANNELS } from "../channels.js";

import {
  createIpcContract,
  createIpcEventContract,
  type NoPayloadIpcContract,
} from "../contract-runtime.js";

const UpdaterStatusSchema = Schema.Literal(
  "idle",
  "checking",
  "available",
  "downloading",
  "downloaded",
  "restart-pending",
  "error",
);

export const UpdateInfoSnapshotSchema = Schema.Struct({
  version: Schema.String,
  releaseNotes: Schema.optional(Schema.NullOr(Schema.String)),
  releaseName: Schema.optional(Schema.NullOr(Schema.String)),
  releaseDate: Schema.optional(Schema.NullOr(Schema.String)),
});

const UpdaterErrorInfoSchema = Schema.Struct({
  message: Schema.String,
  attempt: Schema.Number,
});

export const UpdaterStateSchema = Schema.Struct({
  status: UpdaterStatusSchema,
  updateInfo: Schema.NullOr(UpdateInfoSnapshotSchema),
  downloadPercent: Schema.Number,
  error: Schema.NullOr(UpdaterErrorInfoSchema),
  errorCount: Schema.Number,
  lastCheckAt: Schema.NullOr(Schema.Number),
  userConsented: Schema.Boolean,
});

function createUpdaterStateContract(
  channel: string,
): NoPayloadIpcContract<Schema.Schema.Type<typeof UpdaterStateSchema>> {
  return createIpcContract({
    channel,
    request: Schema.Void,
    response: UpdaterStateSchema,
  });
}

export const updatesContracts = {
  getState: createUpdaterStateContract(IPC_CHANNELS.updates.getState),
  check: createUpdaterStateContract(IPC_CHANNELS.updates.check),
  download: createUpdaterStateContract(IPC_CHANNELS.updates.download),
  install: createUpdaterStateContract(IPC_CHANNELS.updates.install),
  event: createIpcEventContract({
    channel: IPC_CHANNELS.updates.event,
    payload: UpdaterStateSchema,
  }),
} as const;

export const updatesContractList = [
  updatesContracts.getState,
  updatesContracts.check,
  updatesContracts.download,
  updatesContracts.install,
  updatesContracts.event,
] as const;
