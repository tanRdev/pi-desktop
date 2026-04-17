import { spawn } from "node:child_process";
import type { Writable } from "node:stream";
import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  ModelSnapshot,
  ModelSwitchRequest,
  PiDesktopAgentEvent,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";
import { Effect, Either } from "effect";

import { normalizeAgentSessionEvent } from "../events/normalize-agent-session-event.js";
import { applyEventToSnapshot } from "../state/state-helpers.js";

type AgentListener = (event: PiDesktopAgentEvent) => void;

type SpawnProcess = typeof spawn;

type RpcStateLike = {
  model?: {
    id: string;
    name?: string;
    provider: string;
    reasoning?: boolean;
    input?: string[];
    contextWindow?: number;
    maxTokens?: number;
  };
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  isStreaming: boolean;
  sessionId: string;
};

type RpcResponseLike = {
  id?: string;
  type: "response";
  command: string;
  success: boolean;
  data?: unknown;
  error?: string;
};

function safeJsonParse(text: string): unknown | null {
  const result = Effect.runSync(
    Effect.either(
      Effect.try({
        try: () => JSON.parse(text),
        catch: () => null,
      }),
    ),
  );

  return Either.isRight(result) ? result.right : null;
}

type RpcMessageLike = {
  role: string;
  timestamp: number;
  content?: string | Array<{ type?: string; text?: string }>;
};

type PendingRequest = {
  command: string;
  resolve(value: unknown): void;
  reject(error: Error): void;
};

type ChildProcessLike = {
  stdin: Writable;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  on(event: "error", listener: (error: Error) => void): ChildProcessLike;
  on(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): ChildProcessLike;
  kill(signal?: NodeJS.Signals | number): boolean;
};

type PiCliRpcAgentRuntimeOptions = {
  cwd: string;
  agentDir: string;
  spawnProcess?: SpawnProcess;
  env?: NodeJS.ProcessEnv;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRpcResponse(value: unknown): value is RpcResponseLike {
  return (
    isRecord(value) &&
    value.type === "response" &&
    typeof value.command === "string" &&
    typeof value.success === "boolean"
  );
}

function isRpcMessage(value: unknown): value is RpcMessageLike {
  return (
    isRecord(value) &&
    typeof value.role === "string" &&
    typeof value.timestamp === "number"
  );
}

function getMessageText(message: RpcMessageLike): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .flatMap((item) =>
      item && typeof item.text === "string" ? [item.text] : [],
    )
    .join("");
}

function toSnapshotRole(role: string): AgentMessageSnapshot["role"] | null {
  if (role === "assistant" || role === "system" || role === "user") {
    return role;
  }

  if (role === "toolResult") {
    return "tool";
  }

  return null;
}

function toSnapshotMessages(messages: unknown[]): AgentMessageSnapshot[] {
  return messages.flatMap((message) => {
    if (!isRpcMessage(message)) {
      return [];
    }

    const role = toSnapshotRole(message.role);

    if (!role) {
      return [];
    }

    return [
      {
        id: `${role}-${message.timestamp}`,
        role,
        text: getMessageText(message),
        status: "complete" as const,
        timestamp: message.timestamp,
      },
    ];
  });
}

function mapThinkingLevel(
  level: RpcStateLike["thinkingLevel"],
): SettingsSnapshot["thinkingLevel"] {
  switch (level) {
    case "off":
      return "none";
    case "minimal":
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
    case "xhigh":
      return "high";
    default:
      return undefined;
  }
}

function createExitError(
  code: number | null,
  signal: NodeJS.Signals | null,
): Error {
  return new Error(
    `Pi CLI RPC process exited (${code ?? signal ?? "unknown"})`,
  );
}

export class PiCliRpcAgentRuntime {
  private readonly listeners = new Set<AgentListener>();

  private readonly spawnProcess: SpawnProcess;

  private readonly cwd: string;

  private readonly agentDir: string;

  private readonly env: NodeJS.ProcessEnv;

  private childProcess: ChildProcessLike | null = null;

  private bootstrapPromise: Promise<void> | null = null;

  private requestCounter = 0;

  private readonly pendingRequests = new Map<string, PendingRequest>();

  private rpcState: RpcStateLike | null = null;

  private snapshot: AgentSnapshot = {
    sessionId: "",
    status: "starting",
    messages: [],
    lastError: null,
  };

  constructor({
    cwd,
    agentDir,
    spawnProcess = spawn,
    env = process.env,
  }: PiCliRpcAgentRuntimeOptions) {
    this.cwd = cwd;
    this.agentDir = agentDir;
    this.spawnProcess = spawnProcess;
    this.env = env;
  }

  /**
   * Resolve the `pi` binary command. Checks `PI_CLI_PATH` env var first,
   * then falls back to bare `"pi"` (PATH lookup).
   */
  private resolvePiCommand(): string {
    const explicit = this.env.PI_CLI_PATH;
    if (explicit && typeof explicit === "string" && explicit.length > 0) {
      return explicit;
    }
    return "pi";
  }

  async bootstrap(): Promise<void> {
    if (this.childProcess) {
      return;
    }

    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.startProcess();
    }

    try {
      await this.bootstrapPromise;
    } finally {
      this.bootstrapPromise = null;
    }
  }

  async reset(): Promise<void> {
    await this.bootstrap();
    await this.sendCommand({ type: "new_session" });
    await this.refreshSnapshot();
    this.emit({ type: "session_changed" });
  }

  async getProviders(): Promise<ProviderSnapshot[]> {
    await this.bootstrap();
    const response = await this.sendCommand({
      type: "get_available_models",
    });
    const data = isRecord(response) ? response : {};
    const models = Array.isArray(data.models) ? data.models : [];
    const providerMap = new Map<string, ModelSnapshot[]>();

    for (const model of models) {
      if (!isRecord(model)) {
        continue;
      }

      const providerId =
        typeof model.provider === "string" ? model.provider : null;
      const modelId = typeof model.id === "string" ? model.id : null;

      if (!providerId || !modelId) {
        continue;
      }

      const providerModels = providerMap.get(providerId) ?? [];
      providerModels.push({
        id: modelId,
        name: typeof model.name === "string" ? model.name : modelId,
        providerId,
        supportsThinking:
          typeof model.reasoning === "boolean" ? model.reasoning : undefined,
        supportsVision: Array.isArray(model.input)
          ? model.input.includes("image")
          : false,
        contextWindow:
          typeof model.contextWindow === "number"
            ? model.contextWindow
            : undefined,
        maxOutputTokens:
          typeof model.maxTokens === "number" ? model.maxTokens : undefined,
      });
      providerMap.set(providerId, providerModels);
    }

    return Array.from(providerMap.entries()).map(
      ([providerId, providerModels]) => ({
        id: providerId,
        name: providerId,
        models: providerModels,
        isConfigured: true,
      }),
    );
  }

  async getSettings(): Promise<SettingsSnapshot> {
    await this.bootstrap();

    if (!this.rpcState) {
      await this.refreshSnapshot();
    }

    return {
      currentProviderId: this.rpcState?.model?.provider,
      currentModelId: this.rpcState?.model?.id,
      defaultProvider: this.rpcState?.model?.provider,
      defaultModel: this.rpcState?.model?.id,
      thinkingLevel: mapThinkingLevel(this.rpcState?.thinkingLevel),
    };
  }

  subscribe(listener: AgentListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AgentSnapshot {
    return {
      ...this.snapshot,
      messages: this.snapshot.messages.map((message) => ({ ...message })),
    };
  }

  async prompt(text: string): Promise<void> {
    await this.bootstrap();
    this.snapshot = {
      ...this.snapshot,
      status: "starting",
      lastError: null,
    };
    await this.sendCommand({ type: "prompt", message: text });
  }

  async switchModel(request: ModelSwitchRequest): Promise<void> {
    await this.bootstrap();
    await this.sendCommand({
      type: "set_model",
      provider: request.providerId,
      modelId: request.modelId,
    });
    await this.refreshSnapshot();
  }

  async cancelPrompt(): Promise<void> {
    await this.bootstrap();
    await this.sendCommand({ type: "abort" });
    await this.refreshSnapshot();
  }

  private async startProcess(): Promise<void> {
    const piCommand = this.resolvePiCommand();
    const child = this.spawnProcess(
      piCommand,
      ["--mode", "rpc", "--continue"],
      {
        cwd: this.cwd,
        env: {
          ...this.env,
          PI_CODING_AGENT_DIR: this.agentDir,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    ) as ChildProcessLike;

    this.childProcess = child;
    child.stdout?.setEncoding?.("utf8");
    child.stderr?.setEncoding?.("utf8");

    let stdoutBuffer = "";
    child.stdout?.on("data", (chunk: string | Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim().length === 0) {
          continue;
        }

        this.handleLine(line);
      }
    });

    child.on("error", (error) => {
      const isEnoent =
        error &&
        "code" in error &&
        (error as { code: string }).code === "ENOENT";
      if (isEnoent) {
        this.handleProcessFailure(
          new Error(
            `Could not find the 'pi' CLI (tried: ${piCommand}). ` +
              "Make sure 'pi' is installed and accessible, or set the PI_CLI_PATH environment variable.",
          ),
        );
        return;
      }
      this.handleProcessFailure(error);
    });

    child.on("close", (code, signal) => {
      this.handleProcessFailure(createExitError(code, signal));
    });

    await this.refreshSnapshot();
  }

  private handleLine(line: string): void {
    const parsed = safeJsonParse(line);
    if (parsed === null) {
      return;
    }

    if (isRpcResponse(parsed)) {
      const requestId = typeof parsed.id === "string" ? parsed.id : null;

      if (!requestId) {
        return;
      }

      const pendingRequest = this.pendingRequests.get(requestId);

      if (!pendingRequest) {
        if (!parsed.success && parsed.command === "prompt") {
          this.setErrorState(
            parsed.error ?? "Unknown Pi CLI RPC error",
            this.snapshot.sessionId,
          );
        }
        return;
      }

      this.pendingRequests.delete(requestId);

      if (!parsed.success) {
        pendingRequest.reject(
          new Error(parsed.error ?? `Pi RPC ${pendingRequest.command} failed`),
        );
        return;
      }

      pendingRequest.resolve(parsed.data);
      return;
    }

    const normalized = normalizeAgentSessionEvent(parsed as AgentSessionEvent);

    if (!normalized) {
      return;
    }

    this.snapshot = applyEventToSnapshot(this.snapshot, normalized);
    this.emit(normalized);
  }

  private async refreshSnapshot(): Promise<void> {
    const [stateResponse, messagesResponse] = await Promise.all([
      this.sendCommand({ type: "get_state" }),
      this.sendCommand({ type: "get_messages" }),
    ]);

    const state = this.parseRpcState(stateResponse);
    const messages = this.parseRpcMessages(messagesResponse);
    this.rpcState = state;
    this.snapshot = {
      sessionId: state.sessionId,
      status: state.isStreaming ? "streaming" : "ready",
      messages,
      lastError: null,
      currentProviderId: state.model?.provider,
      currentModelId: state.model?.id,
    };
  }

  private parseRpcState(value: unknown): RpcStateLike {
    if (!isRecord(value) || typeof value.sessionId !== "string") {
      throw new Error("Pi RPC returned invalid session state");
    }

    return {
      model:
        isRecord(value.model) &&
        typeof value.model.id === "string" &&
        typeof value.model.provider === "string"
          ? {
              id: value.model.id,
              name:
                typeof value.model.name === "string"
                  ? value.model.name
                  : undefined,
              provider: value.model.provider,
              reasoning:
                typeof value.model.reasoning === "boolean"
                  ? value.model.reasoning
                  : undefined,
              input: Array.isArray(value.model.input)
                ? value.model.input.filter(
                    (entry): entry is string => typeof entry === "string",
                  )
                : undefined,
              contextWindow:
                typeof value.model.contextWindow === "number"
                  ? value.model.contextWindow
                  : undefined,
              maxTokens:
                typeof value.model.maxTokens === "number"
                  ? value.model.maxTokens
                  : undefined,
            }
          : undefined,
      thinkingLevel:
        value.thinkingLevel === "off" ||
        value.thinkingLevel === "minimal" ||
        value.thinkingLevel === "low" ||
        value.thinkingLevel === "medium" ||
        value.thinkingLevel === "high" ||
        value.thinkingLevel === "xhigh"
          ? value.thinkingLevel
          : undefined,
      isStreaming: value.isStreaming === true,
      sessionId: value.sessionId,
    };
  }

  private parseRpcMessages(value: unknown): AgentMessageSnapshot[] {
    if (!isRecord(value)) {
      return [];
    }

    return toSnapshotMessages(
      Array.isArray(value.messages) ? value.messages : [],
    );
  }

  private sendCommand(command: {
    type: string;
    [key: string]: unknown;
  }): Promise<unknown> {
    if (!this.childProcess) {
      return Promise.reject(new Error("Pi CLI RPC process is not running"));
    }

    const requestId = String(++this.requestCounter);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        command: command.type,
        resolve,
        reject,
      });

      this.childProcess?.stdin.write(
        `${JSON.stringify({ ...command, id: requestId })}\n`,
      );
    });
  }

  private handleProcessFailure(error: Error): void {
    for (const pendingRequest of this.pendingRequests.values()) {
      pendingRequest.reject(error);
    }
    this.pendingRequests.clear();
    this.childProcess = null;
    this.setErrorState(error.message, this.snapshot.sessionId);
  }

  private setErrorState(message: string, sessionId: string): void {
    this.snapshot = {
      ...this.snapshot,
      sessionId,
      status: "error",
      lastError: message,
    };
  }

  private emit(event: PiDesktopAgentEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export type { PiCliRpcAgentRuntimeOptions };
