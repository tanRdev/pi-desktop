import path from "node:path";
import type { CreateAgentRuntimeOptions } from "@pi-desktop/agent-host";

type AgentRuntimeMode = CreateAgentRuntimeOptions["mode"];

export interface CreateThreadRuntimeLaunchDetailsOptions {
  threadId: string;
  worktreePath: string;
  mode: AgentRuntimeMode;
  socketDirectory: string;
  execPath: string;
  sessionServerEntryPath: string;
  nodeEnv?: string;
  agentDirectory?: string;
}

export interface ThreadRuntimeLaunchDetails {
  threadId: string;
  worktreePath: string;
  runtimeId: string;
  socketPath: string;
  agentDirectory: string;
  command: string[];
}

function createThreadAgentDirectory(
  baseAgentDirectory: string,
  threadId: string,
): string {
  return path.join(baseAgentDirectory, "threads", threadId);
}

export function createThreadRuntimeLaunchDetails({
  threadId,
  worktreePath,
  mode,
  socketDirectory,
  execPath,
  sessionServerEntryPath,
  nodeEnv,
  agentDirectory,
}: CreateThreadRuntimeLaunchDetailsOptions): ThreadRuntimeLaunchDetails {
  const socketFileName = `pd-${threadId.slice(0, 8) || "thread"}.sock`;
  const socketPath = path.join(socketDirectory, socketFileName);
  const resolvedAgentDirectory =
    agentDirectory ?? path.join(worktreePath, ".pi", "agent");
  const runtimeAgentDirectory = createThreadAgentDirectory(
    resolvedAgentDirectory,
    threadId,
  );

  return {
    threadId,
    worktreePath,
    runtimeId: `local-${threadId}`,
    socketPath,
    agentDirectory: runtimeAgentDirectory,
    command: [
      "env",
      "ELECTRON_RUN_AS_NODE=1",
      `PI_DESKTOP_AGENT_SOCKET_PATH=${socketPath}`,
      `PI_DESKTOP_AGENT_MODE=${mode}`,
      `PI_DESKTOP_AGENT_CWD=${worktreePath}`,
      `PI_DESKTOP_AGENT_DIR=${runtimeAgentDirectory}`,
      ...(nodeEnv ? [`NODE_ENV=${nodeEnv}`] : []),
      execPath,
      sessionServerEntryPath,
    ],
  };
}
