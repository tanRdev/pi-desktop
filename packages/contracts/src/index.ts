import { IPC_CHANNELS } from "@pi-desktop/shared";
import { Schema } from "effect";
import {
  AgentSnapshotSchema,
  ProviderSnapshotArraySchema,
  SettingsSnapshotSchema,
  ShellSnapshotSchema,
} from "./schemas.js";

export * from "./schemas.js";

/**
 * A typed IPC contract declaring the request payload schema, response payload
 * schema, and the channel string. The request/response schemas are used for
 * runtime validation on both sides of the IPC boundary.
 */
export interface IpcContract<TRequest, TResponse> {
  readonly channel: string;
  readonly request: Schema.Schema<TRequest>;
  readonly response: Schema.Schema<TResponse>;
}

/**
 * A contract whose request is `void` (no-payload channels).
 */
export type NoPayloadIpcContract<TResponse> = IpcContract<void, TResponse>;

function createNoPayloadContract<TResponse>(
  channel: string,
  response: Schema.Schema<TResponse>,
): NoPayloadIpcContract<TResponse> {
  return {
    channel,
    request: Schema.Void,
    response,
  };
}

/**
 * The four no-payload read channels wired end-to-end onto schema-validated
 * contracts. These are the keystone proof that the contracts package can
 * replace `payload-parsers.ts` as the single source of truth for IPC shapes.
 */
export const snapshotContracts = {
  shell: {
    getSnapshot: createNoPayloadContract(
      IPC_CHANNELS.shell.getSnapshot,
      ShellSnapshotSchema,
    ),
  },
  agent: {
    getProviders: createNoPayloadContract(
      IPC_CHANNELS.agent.getProviders,
      ProviderSnapshotArraySchema,
    ),
    getSettings: createNoPayloadContract(
      IPC_CHANNELS.agent.getSettings,
      SettingsSnapshotSchema,
    ),
    getSnapshot: createNoPayloadContract(
      IPC_CHANNELS.agent.getSnapshot,
      AgentSnapshotSchema,
    ),
  },
} as const;

// ---------------------------------------------------------------------------
// Renderer-side: typed invocation through a contract.
// ---------------------------------------------------------------------------

export type ContractInvoke = <TReturn>(
  channel: string,
  payload?: unknown,
) => Promise<TReturn>;

/**
 * Build a strongly-typed `invokeContract(contract)` helper that decodes the
 * response payload via the contract's response schema and throws on mismatch.
 *
 * Response decoding uses `Schema.decodeUnknownSync` — an invalid shape raises
 * a `ParseError` that the caller (or the async boundary) will surface.
 */
export function createContractInvoker(invoke: ContractInvoke) {
  return async function invokeContract<TResponse>(
    contract: NoPayloadIpcContract<TResponse>,
  ): Promise<TResponse> {
    const raw = await invoke<unknown>(contract.channel, undefined);
    return Schema.decodeUnknownSync(contract.response)(raw);
  };
}

// ---------------------------------------------------------------------------
// Main-side: typed handler registration with outbound schema validation.
// ---------------------------------------------------------------------------

export interface ContractHandlerRegistrar {
  handle(
    channel: string,
    listener: (
      event?: unknown,
      payload?: unknown,
    ) => Promise<unknown> | unknown,
  ): void;
}

export interface NoPayloadContractHandler<TResponse> {
  readonly contract: NoPayloadIpcContract<TResponse>;
  readonly handler: () => Promise<TResponse> | TResponse;
}

/**
 * Register a single no-payload contract handler. The returned value is
 * decoded via the contract's response schema before being sent, guaranteeing
 * the handler never emits a shape that drifts from the contract.
 */
export function registerContractHandler<TResponse>({
  handle,
  contract,
  handler,
}: {
  readonly handle: ContractHandlerRegistrar["handle"];
  readonly contract: NoPayloadIpcContract<TResponse>;
  readonly handler: () => Promise<TResponse> | TResponse;
}): void {
  const decode = Schema.decodeUnknownSync(contract.response);

  handle(contract.channel, async () => {
    const result = await handler();
    return decode(result);
  });
}

export interface RegisterContractHandlersOptions {
  readonly handle: ContractHandlerRegistrar["handle"];
  readonly contracts: ReadonlyArray<NoPayloadContractHandler<unknown>>;
}

/**
 * Bulk form of `registerContractHandler`. Preserved so existing call sites
 * can migrate incrementally.
 */
export function registerContractHandlers({
  handle,
  contracts,
}: RegisterContractHandlersOptions): void {
  for (const contractHandler of contracts) {
    registerContractHandler({
      handle,
      contract: contractHandler.contract,
      handler: contractHandler.handler,
    });
  }
}
