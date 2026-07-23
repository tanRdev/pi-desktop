import { Schema } from "effect";
import { IPC_CHANNELS } from "./channels.js";
import {
  createIpcContract,
  type NoPayloadIpcContract,
} from "./contract-runtime.js";
import {
  AgentSnapshotSchema,
  ProviderSnapshotArraySchema,
  SettingsSnapshotSchema,
  ShellSnapshotSchema,
} from "./schemas.js";

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
