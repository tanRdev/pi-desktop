import path from "node:path";
import type { AgentSnapshot } from "@pidesk/shared";
import {
  type CreateAgentRuntimeOptions,
  createAgentRuntime,
} from "../../../../packages/agent-host/src/runtime/create-agent-runtime";

type AgentRuntimeEnvironment = Partial<
  Record<
    "NODE_ENV" | "PIDESK_AGENT_CWD" | "PIDESK_AGENT_DIR" | "PIDESK_AGENT_MODE",
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
};

function resolveAgentRuntimeMode(
  environment: AgentRuntimeEnvironment,
): AgentRuntimeMode {
  if (
    environment.PIDESK_AGENT_MODE === "mock" ||
    environment.PIDESK_AGENT_MODE === "sdk"
  ) {
    return environment.PIDESK_AGENT_MODE;
  }

  return environment.NODE_ENV === "test" ? "mock" : "sdk";
}

export function resolveAgentRuntimeOptions(
  environment: AgentRuntimeEnvironment,
  cwd: string,
): CreateAgentRuntimeOptions {
  const resolvedCwd = environment.PIDESK_AGENT_CWD || cwd;
  const resolvedAgentDir =
    environment.PIDESK_AGENT_DIR || path.join(resolvedCwd, ".pidesk-agent");

  return {
    mode: resolveAgentRuntimeMode(environment),
    cwd: resolvedCwd,
    agentDir: resolvedAgentDir,
  };
}

export function resolveAgentRuntimeLaunchOptions(
  environment: AgentRuntimeEnvironment,
  cwd: string,
  userDataPath: string,
  isPackaged: boolean,
): AgentRuntimeLaunchOptions {
  const fallbackCwd = isPackaged ? path.join(userDataPath, "workspace") : cwd;
  const runtimeOptions = resolveAgentRuntimeOptions(environment, fallbackCwd);

  return {
    cwd: runtimeOptions.cwd,
    env: {
      ...environment,
      PIDESK_AGENT_MODE: runtimeOptions.mode,
      PIDESK_AGENT_CWD: runtimeOptions.cwd,
      PIDESK_AGENT_DIR: runtimeOptions.agentDir,
    },
  };
}

export function prepareAgentRuntimeLaunchOptions(
  environment: AgentRuntimeEnvironment,
  cwd: string,
  userDataPath: string,
  isPackaged: boolean,
  ensureDirectory: EnsureDirectory,
): AgentRuntimeLaunchOptions {
  const launchOptions = resolveAgentRuntimeLaunchOptions(
    environment,
    cwd,
    userDataPath,
    isPackaged,
  );

  ensureDirectory(launchOptions.cwd);

  const agentDirectory = launchOptions.env.PIDESK_AGENT_DIR;

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
  };
}

export function createAgentRuntimeForEntry(
  environment: AgentRuntimeEnvironment,
  cwd: string,
) {
  return createAgentRuntime(resolveAgentRuntimeOptions(environment, cwd));
}
