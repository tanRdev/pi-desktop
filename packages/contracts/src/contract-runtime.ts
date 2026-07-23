import { Schema } from "effect";

/**
 * Structured error shape crossing the Contract boundary.
 * Renderer clients should discriminate on `code`, never scrape `message`.
 */
export interface ContractErrorShape {
  readonly code: string;
  readonly message: string;
}

export type ContractErrorCode =
  | "contract/encode-failed"
  | "contract/decode-failed"
  | "contract/unknown";

export class ContractError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ContractError";
    this.code = code;
  }
}

export function toContractErrorShape(error: unknown): ContractErrorShape {
  if (error instanceof ContractError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") {
      return { code, message: error.message };
    }
    return { code: "contract/unknown", message: error.message };
  }
  return { code: "contract/unknown", message: "IPC contract failure" };
}

function asContractError(
  code: ContractErrorCode,
  cause: unknown,
  fallbackMessage: string,
): ContractError {
  if (cause instanceof ContractError) {
    return cause;
  }
  if (cause instanceof Error) {
    return new ContractError(code, cause.message || fallbackMessage);
  }
  return new ContractError(code, fallbackMessage);
}

/**
 * A typed IPC contract declaring the request payload schema, response payload
 * schema, and the channel string. The request/response schemas are used for
 * runtime validation on both sides of the IPC boundary.
 */
export interface IpcContract<TRequest, TResponse> {
  readonly kind?: "invoke";
  readonly channel: string;
  readonly request: Schema.Schema<TRequest>;
  readonly response: Schema.Schema<TResponse>;
}

/**
 * Push/event channel Contract: typed payload schema, no request/response pair.
 */
export interface IpcEventContract<TPayload> {
  readonly kind: "event";
  readonly channel: string;
  readonly payload: Schema.Schema<TPayload>;
}

/** Registry entry — channel + kind only; schemas are existential. */
export type AnyContract = {
  readonly channel: string;
  readonly kind?: "invoke" | "event";
};

/**
 * A contract whose request is `void` (no-payload channels).
 */
export type NoPayloadIpcContract<TResponse> = IpcContract<void, TResponse>;

export function createIpcContract<TRequest, TResponse>(options: {
  readonly channel: string;
  readonly request: Schema.Schema<TRequest>;
  readonly response: Schema.Schema<TResponse>;
}): IpcContract<TRequest, TResponse> {
  return {
    kind: "invoke",
    channel: options.channel,
    request: options.request,
    response: options.response,
  };
}

export function createIpcEventContract<TPayload>(options: {
  readonly channel: string;
  readonly payload: Schema.Schema<TPayload>;
}): IpcEventContract<TPayload> {
  return {
    kind: "event",
    channel: options.channel,
    payload: options.payload,
  };
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

export function listDeclaredContractChannels(
  contracts: ReadonlyArray<AnyContract>,
): string[] {
  return [...new Set(contracts.map((contract) => contract.channel))].sort();
}

function isVoidRequestSchema(schema: Schema.Schema<unknown>): boolean {
  return schema.ast._tag === "VoidKeyword";
}

// ---------------------------------------------------------------------------
// Renderer/preload-side: typed invocation through a contract.
// ---------------------------------------------------------------------------

export type ContractInvoke = <TReturn>(
  channel: string,
  payload?: unknown,
) => Promise<TReturn>;

/**
 * Build a strongly-typed `invokeContract(contract, request?)` helper that
 * encodes the request, decodes the response, and surfaces ContractError codes.
 */
export function createContractInvoker(invoke: ContractInvoke) {
  return async function invokeContract<TRequest, TResponse>(
    contract: IpcContract<TRequest, TResponse>,
    request?: TRequest,
  ): Promise<TResponse> {
    let encodedRequest: unknown;
    const requestIsVoid = isVoidRequestSchema(
      contract.request as Schema.Schema<unknown>,
    );

    if (!requestIsVoid) {
      try {
        encodedRequest = Schema.encodeUnknownSync(contract.request)(
          request as TRequest,
        );
      } catch (cause) {
        throw asContractError(
          "contract/encode-failed",
          cause,
          `Request failed schema encode for ${contract.channel}`,
        );
      }
    }

    const raw = await invoke<unknown>(contract.channel, encodedRequest);

    try {
      return Schema.decodeUnknownSync(contract.response)(raw);
    } catch (cause) {
      throw asContractError(
        "contract/decode-failed",
        cause,
        `Response failed schema decode for ${contract.channel}`,
      );
    }
  };
}

// ---------------------------------------------------------------------------
// Preload/renderer-side: typed event subscription through a contract.
// ---------------------------------------------------------------------------

export type ContractOn = (
  channel: string,
  listener: (payload: unknown) => void,
) => () => void;

/**
 * Build a strongly-typed subscribe helper that decodes event payloads via the
 * Contract schema. Invalid payloads throw ContractError (no untyped side door).
 */
export function createContractSubscriber(on: ContractOn) {
  return function subscribeContract<TPayload>(
    contract: IpcEventContract<TPayload>,
    listener: (payload: TPayload) => void,
  ): () => void {
    const decode = Schema.decodeUnknownSync(contract.payload);
    return on(contract.channel, (raw) => {
      let payload: TPayload;
      try {
        payload = decode(raw);
      } catch (cause) {
        throw asContractError(
          "contract/decode-failed",
          cause,
          `Event payload failed schema decode for ${contract.channel}`,
        );
      }
      listener(payload);
    });
  };
}

// ---------------------------------------------------------------------------
// Main-side: typed handler registration with inbound/outbound schema validation.
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
 * Register a contract handler. Request payloads are decoded before the
 * handler runs; responses are encoded/validated before being sent.
 */
export function registerContractHandler<TRequest, TResponse>({
  handle,
  contract,
  handler,
}: {
  readonly handle: ContractHandlerRegistrar["handle"];
  readonly contract: IpcContract<TRequest, TResponse>;
  readonly handler: (
    request: TRequest,
    event?: unknown,
  ) => Promise<TResponse> | TResponse;
}): void {
  const decodeRequest = Schema.decodeUnknownSync(contract.request);
  const decodeResponse = Schema.decodeUnknownSync(contract.response);
  const requestIsVoid = isVoidRequestSchema(
    contract.request as Schema.Schema<unknown>,
  );

  handle(contract.channel, async (event, payload) => {
    let request: TRequest;
    try {
      request = requestIsVoid
        ? (undefined as TRequest)
        : decodeRequest(payload);
    } catch (cause) {
      throw asContractError(
        "contract/encode-failed",
        cause,
        `Request failed schema decode for ${contract.channel}`,
      );
    }

    const result = await handler(request, event);

    try {
      return decodeResponse(result);
    } catch (cause) {
      throw asContractError(
        "contract/decode-failed",
        cause,
        `Response failed schema decode for ${contract.channel}`,
      );
    }
  });
}

export interface RegisterContractHandlersOptions {
  readonly handle: ContractHandlerRegistrar["handle"];
  readonly contracts: ReadonlyArray<NoPayloadContractHandler<unknown>>;
}

/**
 * Bulk form of `registerContractHandler` for no-payload handlers.
 * Preserved so existing call sites can migrate incrementally.
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
