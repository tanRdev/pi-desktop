import { homedir } from "node:os";
import path from "node:path";
import {
  type AgentSession,
  type AgentSessionEvent,
  AuthStorage,
  createAgentSession as createPiAgentSession,
  ModelRegistry,
  SettingsManager,
} from "@mariozechner/pi-coding-agent";

import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  ModelSnapshot,
  ModelSwitchRequest,
  PiDeskAgentEvent,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pidesk/shared";

import { normalizeAgentSessionEvent } from "../events/normalize-agent-session-event.js";
import { applyEventToSnapshot } from "../state/state-helpers.js";

type AgentListener = (event: PiDeskAgentEvent) => void;

type CreateAgentSession = typeof createPiAgentSession;

type ProviderModelLike = {
  id: string;
  name?: string;
  provider: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
};

type ModelRegistryLike = {
  getAvailable: () => ProviderModelLike[];
  refresh: () => void;
};

type SettingsManagerLike = Pick<
  SettingsManager,
  | "getGlobalSettings"
  | "getProjectSettings"
  | "setDefaultProvider"
  | "setDefaultModel"
>;

type CreateModelRegistry = (
  authFilePath: string,
  modelsFilePath: string,
) => ModelRegistryLike;

type CreateSettingsManager = (
  cwd: string,
  agentDir: string,
) => SettingsManagerLike;

type PiSdkAgentRuntimeOptions = {
  cwd: string;
  agentDir?: string;
  createAgentSession?: CreateAgentSession;
  createModelRegistry?: CreateModelRegistry;
  createSettingsManager?: CreateSettingsManager;
};

type StructuredMessage = {
  role: string;
  timestamp: number;
  content?: Array<{ type?: string; text?: string }>;
};

function isStructuredMessage(value: unknown): value is StructuredMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "role" in value &&
    "timestamp" in value
  );
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

function getMessageText(message: StructuredMessage): string {
  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .flatMap((item) =>
      item && typeof item.text === "string" ? [item.text] : [],
    )
    .join("");
}

function getMessageId(
  message: StructuredMessage,
  role: AgentMessageSnapshot["role"],
): string {
  return `${role}-${message.timestamp}`;
}

function toSnapshotMessages(messages: unknown[]): AgentMessageSnapshot[] {
  return messages.flatMap((message) => {
    if (!isStructuredMessage(message)) {
      return [];
    }

    const role = toSnapshotRole(message.role);

    if (!role) {
      return [];
    }

    return [
      {
        id: getMessageId(message, role),
        role,
        text: getMessageText(message),
        status: "complete" as const,
        timestamp: message.timestamp,
      },
    ];
  });
}

export class PiSdkAgentRuntime {
  private readonly listeners = new Set<AgentListener>();

  private readonly createAgentSession: CreateAgentSession;

  private readonly cwd: string;

  private readonly agentDir?: string;

  private session: AgentSession | null = null;

  private unsubscribeSession: (() => void) | null = null;

  private modelRegistry: ModelRegistryLike | null = null;

  private settingsManager: SettingsManagerLike | null = null;

  private snapshot: AgentSnapshot = {
    sessionId: "",
    status: "starting",
    messages: [],
    lastError: null,
  };

  constructor({
    cwd,
    agentDir,
    createAgentSession = createPiAgentSession,
    createModelRegistry = (authFilePath, modelsFilePath) =>
      new ModelRegistry(AuthStorage.create(authFilePath), modelsFilePath),
    createSettingsManager = (nextCwd, nextAgentDir) =>
      SettingsManager.create(nextCwd, nextAgentDir),
  }: PiSdkAgentRuntimeOptions) {
    this.cwd = cwd;
    this.agentDir = agentDir;
    this.createAgentSession = createAgentSession;

    // Initialize Pi SDK components
    const globalAgentDir = path.join(homedir(), ".pi", "agent");
    const resolvedAgentDir = agentDir ?? globalAgentDir;

    // Initialize model registry with auth storage
    this.modelRegistry = createModelRegistry(
      path.join(globalAgentDir, "auth.json"),
      path.join(globalAgentDir, "models.json"),
    );

    // Initialize settings manager
    this.settingsManager = createSettingsManager(cwd, resolvedAgentDir);
  }

  async bootstrap(): Promise<void> {
    if (this.session) {
      return;
    }

    try {
      const result = await this.createAgentSession({
        cwd: this.cwd,
        agentDir: this.agentDir,
      });

      this.session = result.session;
      this.unsubscribeSession?.();
      this.unsubscribeSession = this.session.subscribe(
        (event: AgentSessionEvent) => {
          const normalized = normalizeAgentSessionEvent(event);

          if (normalized) {
            this.snapshot = applyEventToSnapshot(this.snapshot, normalized);
            this.emit(normalized);
          }
        },
      );

      this.refreshSnapshot("ready");
    } catch (error) {
      this.setErrorState(error, "");
      throw error;
    }
  }

  async reset(): Promise<void> {
    // Dispose existing session if present, then create a fresh session.
    try {
      this.unsubscribeSession?.();
      this.unsubscribeSession = null;
      this.session = null;

      const result = await this.createAgentSession({
        cwd: this.cwd,
        agentDir: this.agentDir,
      });

      this.session = result.session;
      this.unsubscribeSession = this.session.subscribe(
        (event: AgentSessionEvent) => {
          const normalized = normalizeAgentSessionEvent(event);

          if (normalized) {
            this.snapshot = applyEventToSnapshot(this.snapshot, normalized);
            this.emit(normalized);
          }
        },
      );

      this.refreshSnapshot("ready");
      // Notify listeners that a reset happened
      this.emit({ type: "agent_end" });
      this.emit({ type: "agent_start" });
    } catch (error) {
      this.setErrorState(error, "");
      throw error;
    }
  }

  async getProviders(): Promise<ProviderSnapshot[]> {
    if (!this.modelRegistry) {
      return [];
    }

    // Refresh the registry so newly-added providers (e.g. via CLI) are picked up
    this.modelRegistry.refresh();

    // Get all available models
    const models = this.modelRegistry.getAvailable();

    // Group by provider
    const providerMap = new Map<string, ModelSnapshot[]>();

    for (const model of models) {
      const providerId = model.provider;
      if (!providerMap.has(providerId)) {
        providerMap.set(providerId, []);
      }

      providerMap.get(providerId)?.push({
        id: model.id,
        name: model.name ?? model.id,
        providerId,
        supportsThinking: model.reasoning,
        supportsVision: model.input?.includes("image") ?? false,
        contextWindow: model.contextWindow,
      });
    }

    // Convert to ProviderSnapshot array
    const result: ProviderSnapshot[] = [];

    for (const [providerId, providerModels] of providerMap) {
      result.push({
        id: providerId,
        name: providerId, // TODO: get provider display name
        models: providerModels,
        isConfigured: true, // getAvailable only returns configured models
      });
    }

    return result;
  }

  async getSettings(): Promise<SettingsSnapshot> {
    if (!this.settingsManager) {
      return {};
    }

    const globalSettings = this.settingsManager.getGlobalSettings();
    const projectSettings = this.settingsManager.getProjectSettings();

    return {
      currentProviderId:
        projectSettings.defaultProvider ?? globalSettings.defaultProvider,
      currentModelId:
        projectSettings.defaultModel ?? globalSettings.defaultModel,
      defaultProvider: globalSettings.defaultProvider,
      defaultModel: globalSettings.defaultModel,
      thinkingLevel: this.mapThinkingLevel(
        projectSettings.defaultThinkingLevel ??
          globalSettings.defaultThinkingLevel,
      ),
    };
  }

  private mapThinkingLevel(
    level: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | undefined,
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

  async switchModel(request: ModelSwitchRequest): Promise<void> {
    if (!this.settingsManager) {
      throw new Error("Settings manager not initialized");
    }

    // Update settings
    this.settingsManager.setDefaultProvider(request.providerId);
    this.settingsManager.setDefaultModel(request.modelId);

    // Emit model change event
    this.emit({
      type: "model_changed",
      providerId: request.providerId,
      modelId: request.modelId,
    });
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
      messages: this.snapshot.messages.map((message: AgentMessageSnapshot) => ({
        ...message,
      })),
    };
  }

  async prompt(text: string): Promise<void> {
    await this.bootstrap();

    if (!this.session) {
      throw new Error("PiDesk Pi SDK runtime failed to initialize a session");
    }

    this.snapshot = {
      ...this.snapshot,
      status: "streaming",
      lastError: null,
    };

    try {
      await this.session.prompt(text);
      this.refreshSnapshot("ready");
    } catch (error) {
      this.setErrorState(error, this.session.sessionId);
      throw error;
    }
  }

  private refreshSnapshot(status: AgentSnapshot["status"]): void {
    if (!this.session) {
      return;
    }

    this.snapshot = {
      sessionId: this.session.sessionId,
      status,
      messages: toSnapshotMessages(this.session.messages),
      lastError: null,
    };
  }

  private setErrorState(error: unknown, sessionId: string): void {
    this.snapshot = {
      sessionId,
      status: "error",
      messages: this.snapshot.messages,
      lastError:
        error instanceof Error ? error.message : "Unknown Pi SDK runtime error",
    };
  }

  private emit(event: PiDeskAgentEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export type { PiSdkAgentRuntimeOptions };
