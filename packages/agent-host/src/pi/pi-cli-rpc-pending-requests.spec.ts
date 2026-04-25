import type { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import type { PendingRequest } from "./pi-cli-rpc-line-handler.js";

type SendCommand = (command: {
  type: string;
  [key: string]: unknown;
}) => Promise<unknown>;

type CreatePendingRequestDispatcher = (input: {
  stdin: Writable;
  pendingRequests: Map<string, PendingRequest>;
  serializeCommand(command: { type: string; [key: string]: unknown }): string;
  initialRequestCounter?: number;
}) => {
  sendCommand: SendCommand;
  getRequestCounter(): number;
};

function isCreatePendingRequestDispatcher(
  value: unknown,
): value is CreatePendingRequestDispatcher {
  return typeof value === "function";
}

async function loadCreatePendingRequestDispatcher(): Promise<CreatePendingRequestDispatcher | null> {
  try {
    const module = await import("./pi-cli-rpc-pending-requests.js");
    return isCreatePendingRequestDispatcher(
      module.createPendingRequestDispatcher,
    )
      ? module.createPendingRequestDispatcher
      : null;
  } catch {
    return null;
  }
}

describe("createPendingRequestDispatcher", () => {
  it("registers pending requests and writes serialized commands with incrementing ids", async () => {
    const createPendingRequestDispatcher =
      await loadCreatePendingRequestDispatcher();

    expect(createPendingRequestDispatcher).not.toBeNull();

    if (!createPendingRequestDispatcher) {
      return;
    }

    const pendingRequests = new Map<string, PendingRequest>();
    const writes: string[] = [];
    const stdin = {
      write(chunk: string): boolean {
        writes.push(chunk);
        return true;
      },
    } as Writable;
    const serializeCommand = vi.fn(
      (command: { type: string; [key: string]: unknown }) =>
        JSON.stringify(command),
    );

    const dispatcher = createPendingRequestDispatcher({
      stdin,
      pendingRequests,
      serializeCommand,
      initialRequestCounter: 41,
    });

    const firstPromise = dispatcher.sendCommand({ type: "get_state" });
    const secondPromise = dispatcher.sendCommand({
      type: "prompt",
      message: "hello",
    });

    expect(dispatcher.getRequestCounter()).toBe(43);
    expect(serializeCommand).toHaveBeenNthCalledWith(1, {
      id: "42",
      type: "get_state",
    });
    expect(serializeCommand).toHaveBeenNthCalledWith(2, {
      id: "43",
      type: "prompt",
      message: "hello",
    });
    expect(writes.map((value) => JSON.parse(value))).toEqual([
      { id: "42", type: "get_state" },
      { id: "43", type: "prompt", message: "hello" },
    ]);
    expect(Array.from(pendingRequests.keys())).toEqual(["42", "43"]);

    const firstRequest = pendingRequests.get("42");
    const secondRequest = pendingRequests.get("43");

    expect(firstRequest?.command).toBe("get_state");
    expect(secondRequest?.command).toBe("prompt");

    firstRequest?.resolve({ sessionId: "cli-session" });
    secondRequest?.reject(new Error("prompt failed"));

    await expect(firstPromise).resolves.toEqual({ sessionId: "cli-session" });
    await expect(secondPromise).rejects.toThrow("prompt failed");
  });
});
