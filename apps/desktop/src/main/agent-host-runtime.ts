import path from "node:path";
import {
  type CreateAgentRuntimeOptions,
  createAgentRuntime,
} from "@pi-desktop/agent-host";
import type { AgentSnapshot } from "@pi-desktop/shared";

type AgentRuntimeEnvironment = Partial<
  Record<
    "NODE_ENV" | "PI_DESKTOP_AGENT_CWD" | "PI_DESKTOP_AGENT_DIR" | "PI_DESKTOP_AGENT_MODE",
    string
  >
>;

type AgentRuntimeMode = CreateAgentRuntimeOptions["mode"];

type AgentRuntimeLaunchOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
};

type EnsureDirectory = (directory: string) => void;

type UnavailableAgentHost = {
  getSnapshot(): Promise<AgentSnapshot>;
  prompt(text: string): Promise<void>;
  cancelPrompt(): Promise<void>;
};

function resolveAgentRuntimeMode(
  environment: AgentRuntimeEnvironment,
): AgentRuntimeMode {
  if (
    environment.PI_DESKTOP_AGENT_MODE === "mock" ||
    environment.PI_DESKTOP_AGENT_MODE === "sdk" ||
    environment.PI_DESKTOP_AGENT_MODE === "cli"
  ) {
    return environment.PI_DESKTOP_AGENT_MODE;
  }

  return environment.NODE_ENV === "test" ? "mock" : "cli";
}

export function resolveAgentRuntimeOptions(
  environment: AgentRuntimeEnvironment,
  cwd: string,
): CreateAgentRuntimeOptions {
  const resolvedCwd = environment.PI_DESKTOP_AGENT_CWD || cwd;
  const resolvedAgentDir =
    environment.PI_DESKTOP_AGENT_DIR || path.join(resolvedCwd, ".pi", "agent");

  const mode = resolveAgentRuntimeMode(environment);

  if (mode === "mock") {
    return {
      mode,
      cwd: resolvedCwd,
      agentDir: resolvedAgentDir,
    };
  }

  return {
    mode,
    cwd: resolvedCwd,
    agentDir: resolvedAgentDir,
  };
}

export function resolveAgentRuntimeLaunchOptions(
  environment: AgentRuntimeEnvironment,
  cwd: string,
  _userDataPath: string,
  isPackaged: boolean,
  homePath: string,
): AgentRuntimeLaunchOptions {
  const fallbackCwd = isPackaged ? homePath : cwd;
  const runtimeOptions = resolveAgentRuntimeOptions(environment, fallbackCwd);

  return {
    cwd: runtimeOptions.cwd,
    env: {
      ...environment,
      PI_DESKTOP_AGENT_MODE: runtimeOptions.mode,
      PI_DESKTOP_AGENT_CWD: runtimeOptions.cwd,
      PI_DESKTOP_AGENT_DIR: runtimeOptions.agentDir,
    },
  };
}

export function prepareAgentRuntimeLaunchOptions(
  environment: AgentRuntimeEnvironment,
  cwd: string,
  _userDataPath: string,
  isPackaged: boolean,
  homePath: string,
  ensureDirectory: EnsureDirectory,
): AgentRuntimeLaunchOptions {
  const launchOptions = resolveAgentRuntimeLaunchOptions(
    environment,
    cwd,
    _userDataPath,
    isPackaged,
    homePath,
  );

  ensureDirectory(launchOptions.cwd);

  const agentDirectory = launchOptions.env.PI_DESKTOP_AGENT_DIR;

  if (agentDirectory) {
    ensureDirectory(agentDirectory);
  }

  return launchOptions;
}

export function createUnavailableAgentHost(
  message: string,
): UnavailableAgentHost {
  return {
    async getSnapshot() {
      return {
        sessionId: "",
        status: "error",
        messages: [],
        lastError: message,
      };
    },
    async prompt() {
      throw new Error(message);
    },
    async cancelPrompt() {
      return Promise.resolve();
    },
  };
}

export function createAgentRuntimeForEntry(
  environment: AgentRuntimeEnvironment,
  cwd: string,
) {
  return createAgentRuntime(resolveAgentRuntimeOptions(environment, cwd));
}
