import { spawn } from "node:child_process";
import type {
  AgentSnapshot,
  ModelSwitchRequest,
  PiDesktopAgentEvent,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";

import { normalizeAgentSessionEvent } from "../events/normalize-agent-session-event.js";
import { applyEventToSnapshot } from "../state/state-helpers.js";
import { serializeRpcCommand } from "./pi-cli-rpc-framing.js";
import {
  handleRpcLine,
  type PendingRequest,
} from "./pi-cli-rpc-line-handler.js";
import { createPendingRequestDispatcher } from "./pi-cli-rpc-pending-requests.js";
import {
  attachCliRpcProcessLifecycle,
  type ChildProcessLike,
} from "./pi-cli-rpc-process-lifecycle.js";
import type { RpcStateLike } from "./pi-cli-rpc-protocol.js";
import { mapRpcProviders, mapRpcSettings } from "./pi-cli-rpc-snapshot.js";
import { refreshCliRpcSnapshot } from "./pi-cli-rpc-snapshot-refresh.js";
import { buildCliRpcSpawnRequest } from "./pi-cli-rpc-spawn.js";

type AgentListener = (event: PiDesktopAgentEvent) => void;

type SpawnProcess = typeof spawn;

type PiCliRpcAgentRuntimeOptions = {
  cwd: string;
  agentDir: string;
  spawnProcess?: SpawnProcess;
  env?: NodeJS.ProcessEnv;
};

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
    const models =
      typeof response === "object" &&
      response !== null &&
      "models" in response &&
      Array.isArray(response.models)
        ? response.models
        : [];

    return mapRpcProviders(models);
  }

  async getSettings(): Promise<SettingsSnapshot> {
    await this.bootstrap();

    if (!this.rpcState) {
      await this.refreshSnapshot();
    }

    return mapRpcSettings(this.rpcState);
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
    const spawnRequest = buildCliRpcSpawnRequest({
      cwd: this.cwd,
      agentDir: this.agentDir,
      env: this.env,
    });
    const child = this.spawnProcess(
      spawnRequest.command,
      spawnRequest.args,
      spawnRequest.options,
    ) as ChildProcessLike;

    this.childProcess = child;
    attachCliRpcProcessLifecycle({
      childProcess: child,
      piCommand: spawnRequest.command,
      handleLine: (line) => {
        this.handleLine(line);
      },
      handleProcessFailure: (error) => {
        this.handleProcessFailure(error);
      },
    });

    await this.refreshSnapshot();
  }

  private handleLine(line: string): void {
    const result = handleRpcLine({
      line,
      snapshot: this.snapshot,
      pendingRequests: this.pendingRequests,
      setErrorState: (message, sessionId) => {
        this.setErrorState(message, sessionId);
        return this.snapshot;
      },
      normalizeEvent: normalizeAgentSessionEvent,
      applyEvent: applyEventToSnapshot,
    });

    this.snapshot = result.snapshot;

    if (result.event) {
      this.emit(result.event);
    }
  }

  private async refreshSnapshot(): Promise<void> {
    const refreshed = await refreshCliRpcSnapshot({
      sendCommand: (command) => this.sendCommand(command),
    });

    this.rpcState = refreshed.rpcState;
    this.snapshot = refreshed.snapshot;
  }

  private sendCommand(command: {
    type: string;
    [key: string]: unknown;
  }): Promise<unknown> {
    if (!this.childProcess) {
      return Promise.reject(new Error("Pi CLI RPC process is not running"));
    }

    const dispatcher = createPendingRequestDispatcher({
      stdin: this.childProcess.stdin,
      pendingRequests: this.pendingRequests,
      serializeCommand: serializeRpcCommand,
      initialRequestCounter: this.requestCounter,
    });

    const promise = dispatcher.sendCommand(command);
    this.requestCounter = dispatcher.getRequestCounter();
    return promise;
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
