import { Schema } from "effect";
import { describe, expect, it, vi } from "vitest";

import {
  ContractError,
  type ContractInvoke,
  createContractInvoker,
  createContractSubscriber,
  createIpcContract,
  createIpcEventContract,
  listDeclaredContractChannels,
  registerContractHandler,
  toContractErrorShape,
} from "./index.js";

describe("ContractError", () => {
  it("carries structured code and message", () => {
    const error = new ContractError(
      "contract/decode-failed",
      "response failed schema decode",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("contract/decode-failed");
    expect(error.message).toBe("response failed schema decode");
    expect(toContractErrorShape(error)).toEqual({
      code: "contract/decode-failed",
      message: "response failed schema decode",
    });
  });

  it("normalizes unknown failures into structured shape", () => {
    expect(toContractErrorShape(new Error("boom"))).toEqual({
      code: "contract/unknown",
      message: "boom",
    });
    expect(toContractErrorShape("string-fail")).toEqual({
      code: "contract/unknown",
      message: "IPC contract failure",
    });
  });
});

describe("payload-bearing invoke and register", () => {
  const echoContract = createIpcContract({
    channel: "test:echo",
    request: Schema.Struct({ text: Schema.String }),
    response: Schema.Struct({ text: Schema.String, length: Schema.Number }),
  });

  it("encodes request and decodes response through the invoker", async () => {
    const invoke = vi.fn(async (_channel: string, payload?: unknown) => ({
      text: (payload as { text: string }).text,
      length: (payload as { text: string }).text.length,
    })) as ContractInvoke;
    const invokeContract = createContractInvoker(invoke);

    await expect(invokeContract(echoContract, { text: "hi" })).resolves.toEqual(
      { text: "hi", length: 2 },
    );

    expect(invoke).toHaveBeenCalledWith("test:echo", { text: "hi" });
  });

  it("rejects invalid request payloads before invoke", async () => {
    const invoke = vi.fn(async () => {
      throw new Error("should not invoke");
    }) as ContractInvoke;
    const invokeContract = createContractInvoker(invoke);

    await expect(
      invokeContract(echoContract, { text: 42 } as never),
    ).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects invalid response payloads from invoke", async () => {
    const invoke = vi.fn(async () => ({
      text: "hi",
      length: "nope",
    })) as ContractInvoke;
    const invokeContract = createContractInvoker(invoke);

    await expect(
      invokeContract(echoContract, { text: "hi" }),
    ).rejects.toMatchObject({
      code: "contract/decode-failed",
    });
  });

  it("decodes request and encodes response in the registrar", async () => {
    const registered = new Map<
      string,
      (event?: unknown, payload?: unknown) => Promise<unknown> | unknown
    >();

    registerContractHandler({
      handle: (channel, listener) => {
        registered.set(channel, listener);
      },
      contract: echoContract,
      handler: async (request) => ({
        text: request.text,
        length: request.text.length,
      }),
    });

    const listener = registered.get("test:echo");
    await expect(listener?.(undefined, { text: "ok" })).resolves.toEqual({
      text: "ok",
      length: 2,
    });
  });

  it("rejects invalid inbound request payloads in the registrar", async () => {
    const registered = new Map<
      string,
      (event?: unknown, payload?: unknown) => Promise<unknown> | unknown
    >();

    registerContractHandler({
      handle: (channel, listener) => {
        registered.set(channel, listener);
      },
      contract: echoContract,
      handler: async (request) => ({
        text: request.text,
        length: request.text.length,
      }),
    });

    const listener = registered.get("test:echo");
    await expect(listener?.(undefined, { text: 9 })).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
  });
});

describe("event contracts", () => {
  const pingEvent = createIpcEventContract({
    channel: "test:ping",
    payload: Schema.Struct({ n: Schema.Number }),
  });

  it("decodes subscribed event payloads", () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const on = vi.fn(
      (channel: string, listener: (payload: unknown) => void) => {
        listeners.set(channel, listener);
        return () => listeners.delete(channel);
      },
    );
    const subscribe = createContractSubscriber(on);
    const received: Array<{ n: number }> = [];

    const unsubscribe = subscribe(pingEvent, (payload) => {
      received.push(payload);
    });

    listeners.get("test:ping")?.({ n: 3 });
    expect(received).toEqual([{ n: 3 }]);

    expect(() => listeners.get("test:ping")?.({ n: "x" })).toThrow(
      ContractError,
    );
    unsubscribe();
    expect(listeners.has("test:ping")).toBe(false);
  });

  it("exposes event channel in the declared channel list", () => {
    const contracts = [
      createIpcContract({
        channel: "test:echo",
        request: Schema.Void,
        response: Schema.Void,
      }),
      pingEvent,
    ];

    expect(listDeclaredContractChannels(contracts)).toEqual([
      "test:echo",
      "test:ping",
    ]);
  });
});
