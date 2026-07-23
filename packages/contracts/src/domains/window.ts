import { Schema } from "effect";
import { IPC_CHANNELS } from "../channels.js";

import {
  createIpcContract,
  createIpcEventContract,
  type NoPayloadIpcContract,
} from "../contract-runtime.js";

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

export const windowContracts = {
  getFullscreenState: createNoPayloadContract(
    IPC_CHANNELS.window.getFullscreenState,
    Schema.Boolean,
  ),
  fullscreenChanged: createIpcEventContract({
    channel: IPC_CHANNELS.window.fullscreenChanged,
    payload: Schema.Boolean,
  }),
} as const;

export const windowContractList = [
  windowContracts.getFullscreenState,
  windowContracts.fullscreenChanged,
] as const;
