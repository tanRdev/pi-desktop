import { homedir } from "node:os";
import path from "node:path";
import {
  type AgentSession,
  AuthStorage,
  createAgentSession as createPiAgentSession,
  ModelRegistry,
  SettingsManager,
} from "@mariozechner/pi-coding-agent";

import type {
  AgentSnapshot,
  ModelSwitchRequest,
  PiDesktopAgentEvent,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";

import { applyEventToSnapshot } from "../state/state-helpers.js";
import { createPiSdkPromptLifecycle } from "./pi-sdk-prompt-lifecycle.js";
import {
  getSdkProviders,
  getSdkSettings,
  type ModelRegistryLike,
  type SettingsManagerLike,
  switchSdkModel,
} from "./pi-sdk-runtime-settings.js";
import {
  buildSdkErrorSnapshot,
  buildSdkSessionSnapshot,
  cloneSdkSnapshot,
} from "./pi-sdk-runtime-snapshot.js";
import { createBootstrappedSession } from "./pi-sdk-session-bootstrap.js";

type AgentListener = (event: PiDesktopAgentEvent) => void;

type CreateAgentSession = typeof createPiAgentSession;

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

export class PiSdkAgentRuntime {
  private readonly listeners = new Set<AgentListener>();

  private readonly createAgentSession: CreateAgentSession;

  private readonly cwd: string;

  private readonly agentDir?: string;

  private session: AgentSession | null = null;

  private unsubscribeSession: (() => void) | null = null;

  private modelRegistry: ModelRegistryLike | null = null;

  private settingsManager: SettingsManagerLike | null = null;

  private readonly promptLifecycle = createPiSdkPromptLifecycle({
    getSession: () => {
      const currentSession = this.session;

      if (!currentSession) {
        return null;
      }

      const waitForIdle = Reflect.get(currentSession, "waitForIdle");

      return {
        sessionId: currentSession.sessionId,
        prompt: (text, options) =>
          // The SDK runtime accepts AbortSignal here even though PromptOptions omits it.
          Reflect.apply(currentSession.prompt, currentSession, [text, options]),
        waitForIdle:
          typeof waitForIdle === "function"
            ? () => Reflect.apply(waitForIdle, currentSession, [])
            : undefined,
      };
    },
    setStreamingState: () => {
      this.snapshot = {
        ...this.snapshot,
        status: "streaming",
        lastError: null,
      };
    },
    refreshReadyState: () => {
      this.refreshSnapshot("ready");
    },
    setErrorState: (error, sessionId) => {
      this.setErrorState(error, sessionId);
    },
  });

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

    const globalAgentDir = path.join(homedir(), ".pi", "agent");
    const resolvedAgentDir = agentDir ?? globalAgentDir;

    this.modelRegistry = createModelRegistry(
      path.join(globalAgentDir, "auth.json"),
      path.join(globalAgentDir, "models.json"),
    );

    this.settingsManager = createSettingsManager(cwd, resolvedAgentDir);
  }

  async bootstrap(): Promise<void> {
    if (this.session) {
      return;
    }

    try {
      const bootstrapped = await this.createSessionWiring();

      this.session = bootstrapped.session;
      this.unsubscribeSession?.();
      this.unsubscribeSession = bootstrapped.unsubscribe;
      this.snapshot = bootstrapped.snapshot;
    } catch (error) {
      this.setErrorState(error, "");
      throw error;
    }
  }

  async reset(): Promise<void> {
    try {
      this.unsubscribeSession?.();
      this.unsubscribeSession = null;
      this.session = null;

      const bootstrapped = await this.createSessionWiring();

      this.session = bootstrapped.session;
      this.unsubscribeSession = bootstrapped.unsubscribe;
      this.snapshot = bootstrapped.snapshot;
      this.emit({ type: "agent_end" });
      this.emit({ type: "agent_start" });
    } catch (error) {
      this.setErrorState(error, "");
      throw error;
    }
  }

  async getProviders(): Promise<ProviderSnapshot[]> {
    return getSdkProviders(this.modelRegistry);
  }

  async getSettings(): Promise<SettingsSnapshot> {
    return getSdkSettings(this.settingsManager);
  }

  async switchModel(request: ModelSwitchRequest): Promise<void> {
    this.emit(switchSdkModel(this.settingsManager, request));
  }

  subscribe(listener: AgentListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AgentSnapshot {
    return cloneSdkSnapshot(this.snapshot, this.session);
  }

  async prompt(text: string): Promise<void> {
    await this.bootstrap();

    await this.promptLifecycle.prompt(text);
  }

  async cancelPrompt(): Promise<void> {
    await this.promptLifecycle.cancel();
  }

  private createSessionWiring() {
    return createBootstrappedSession({
      createSession: this.createAgentSession,
      createSessionOptions: {
        cwd: this.cwd,
        agentDir: this.agentDir,
      },
      snapshot: this.snapshot,
      applyNormalizedEvent: (snapshot, event) => {
        const nextSnapshot = applyEventToSnapshot(snapshot, event);
        this.snapshot = nextSnapshot;
        return nextSnapshot;
      },
      emit: (event) => {
        this.emit(event);
      },
      refreshReadySnapshot: (session) => {
        this.session = session;
        this.refreshSnapshot("ready");
        return this.snapshot;
      },
    });
  }

  private refreshSnapshot(status: AgentSnapshot["status"]): void {
    if (!this.session) {
      return;
    }

    this.snapshot = buildSdkSessionSnapshot(this.session, status);
  }

  private setErrorState(error: unknown, sessionId: string): void {
    this.snapshot = buildSdkErrorSnapshot(this.snapshot, sessionId, error);
  }

  private emit(event: PiDesktopAgentEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export type { PiSdkAgentRuntimeOptions };
