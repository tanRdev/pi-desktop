import type { Writable } from "node:stream";

import type { PendingRequest } from "./pi-cli-rpc-line-handler.js";

type RpcCommand = {
  type: string;
  [key: string]: unknown;
};

type CreatePendingRequestDispatcherInput = {
  stdin: Writable;
  pendingRequests: Map<string, PendingRequest>;
  serializeCommand(command: RpcCommand): string;
  initialRequestCounter?: number;
};

type PendingRequestDispatcher = {
  sendCommand(command: RpcCommand): Promise<unknown>;
  getRequestCounter(): number;
};

export function createPendingRequestDispatcher({
  stdin,
  pendingRequests,
  serializeCommand,
  initialRequestCounter = 0,
}: CreatePendingRequestDispatcherInput): PendingRequestDispatcher {
  let requestCounter = initialRequestCounter;

  return {
    sendCommand(command) {
      const requestId = String(++requestCounter);

      return new Promise((resolve, reject) => {
        pendingRequests.set(requestId, {
          command: command.type,
          resolve,
          reject,
        });

        stdin.write(serializeCommand({ ...command, id: requestId }));
      });
    },
    getRequestCounter() {
      return requestCounter;
    },
  };
}

export type { CreatePendingRequestDispatcherInput, PendingRequestDispatcher };
