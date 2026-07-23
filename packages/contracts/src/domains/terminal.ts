import type {
  TerminalCreateOptions,
  TerminalEvent,
  TerminalSession,
} from "@pi-desktop/shared";
import { IPC_CHANNELS } from "@pi-desktop/shared";
import { Schema } from "effect";

import {
  createIpcContract,
  createIpcEventContract,
  type NoPayloadIpcContract,
} from "../contract-runtime.js";
import { createStrictObjectSchema } from "./helpers.js";
import {
  finiteNumberSchema,
  ipcStringSchema,
  mutableArray,
  terminalWriteDataSchema,
} from "./schema-primitives.js";

const LinkColorSchema = Schema.Literal(
  "blue",
  "green",
  "orange",
  "pink",
  "purple",
  "yellow",
);

const TerminalBackendSchema = Schema.Literal("shell", "pi");

const TERMINAL_CREATE_KEYS: ReadonlySet<string> = new Set([
  "id",
  "cols",
  "rows",
  "ownerWindowId",
  "cwd",
  "backend",
]);

export type TerminalCreateRequest = TerminalCreateOptions & {
  readonly id: string;
  readonly cwd: string;
};

export const TerminalCreateRequestSchema =
  createStrictObjectSchema<TerminalCreateRequest>(TERMINAL_CREATE_KEYS, {
    id: ipcStringSchema(),
    cols: finiteNumberSchema(),
    rows: finiteNumberSchema(),
    ownerWindowId: ipcStringSchema(),
    cwd: ipcStringSchema(),
    backend: Schema.optional(TerminalBackendSchema),
  });

const TerminalSessionStatusSchema = Schema.Literal(
  "starting",
  "ready",
  "exited",
  "error",
);

export const TerminalSessionSchema = Schema.Struct({
  id: Schema.String,
  backend: TerminalBackendSchema,
  cwd: Schema.String,
  status: TerminalSessionStatusSchema,
  linkColor: Schema.optional(LinkColorSchema),
  ownerWindowId: Schema.String,
  createdAt: Schema.Number,
  lastActivityAt: Schema.optional(Schema.Number),
}) satisfies Schema.Schema<TerminalSession>;

export const TerminalWriteRequestSchema = Schema.Struct({
  id: ipcStringSchema(),
  data: terminalWriteDataSchema(),
});

export const TerminalResizeRequestSchema = Schema.Struct({
  id: ipcStringSchema(),
  cols: finiteNumberSchema(),
  rows: finiteNumberSchema(),
});

export const TerminalDestroyRequestSchema = Schema.Struct({
  id: ipcStringSchema(),
});

const TerminalDataEventSchema = Schema.Struct({
  type: Schema.Literal("data"),
  id: Schema.String,
  data: Schema.String,
});

const TerminalExitEventSchema = Schema.Struct({
  type: Schema.Literal("exit"),
  id: Schema.String,
  exitCode: Schema.Number,
});

export const TerminalEventSchema = Schema.Union(
  TerminalDataEventSchema,
  TerminalExitEventSchema,
) satisfies Schema.Schema<TerminalEvent>;

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

function createNoPayloadContract<TResponse>(
  channel: string,
  response: Schema.Schema<TResponse>,
): NoPayloadIpcContract<TResponse> {
  return createIpcContract({
    channel,
    request: Schema.Void,
    response,
  });
}

export const TerminalSessionArraySchema = mutableArray(TerminalSessionSchema);

export const terminalContracts = {
  create: createIpcContract({
    channel: IPC_CHANNELS.terminal.create,
    request: TerminalCreateRequestSchema,
    response: TerminalSessionSchema,
  }),
  write: createVoidResponseContract(
    IPC_CHANNELS.terminal.write,
    TerminalWriteRequestSchema,
  ),
  resize: createVoidResponseContract(
    IPC_CHANNELS.terminal.resize,
    TerminalResizeRequestSchema,
  ),
  destroy: createVoidResponseContract(
    IPC_CHANNELS.terminal.destroy,
    TerminalDestroyRequestSchema,
  ),
  getSessions: createNoPayloadContract(
    IPC_CHANNELS.terminal.getSessions,
    TerminalSessionArraySchema,
  ),
  event: createIpcEventContract({
    channel: IPC_CHANNELS.terminal.event,
    payload: TerminalEventSchema,
  }),
} as const;

type AssignableTo<Decoded, Target> = Decoded extends Target ? true : never;

type _TerminalSessionAssignable = AssignableTo<
  Schema.Schema.Type<typeof TerminalSessionSchema>,
  TerminalSession
>;
type _TerminalEventAssignable = AssignableTo<
  Schema.Schema.Type<typeof TerminalEventSchema>,
  TerminalEvent
>;

export type TerminalSchemasAssignable =
  | _TerminalSessionAssignable
  | _TerminalEventAssignable;

export const terminalContractList = [
  terminalContracts.create,
  terminalContracts.write,
  terminalContracts.resize,
  terminalContracts.destroy,
  terminalContracts.getSessions,
  terminalContracts.event,
] as const;
