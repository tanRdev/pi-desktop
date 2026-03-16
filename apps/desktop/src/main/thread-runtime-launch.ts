import path from "node:path";
import type { CreateAgentRuntimeOptions } from "@pidesk/agent-host";
import { createTmuxThreadSessionName } from "./tmux-session-naming";

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
  sessionName: string;
  socketPath: string;
  command: string[];
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
  const sessionName = createTmuxThreadSessionName(threadId);
  const socketFileName = `pd-${threadId.slice(0, 8) || "thread"}.sock`;
  const socketPath = path.join(socketDirectory, socketFileName);
  const resolvedAgentDirectory =
    agentDirectory ?? path.join(worktreePath, ".pi", "agent");

  return {
    threadId,
    worktreePath,
    sessionName,
    socketPath,
    command: [
      "env",
      "ELECTRON_RUN_AS_NODE=1",
      `PIDESK_AGENT_SOCKET_PATH=${socketPath}`,
      `PIDESK_AGENT_MODE=${mode}`,
      `PIDESK_AGENT_CWD=${worktreePath}`,
      `PIDESK_AGENT_DIR=${resolvedAgentDirectory}`,
      ...(nodeEnv ? [`NODE_ENV=${nodeEnv}`] : []),
      execPath,
      sessionServerEntryPath,
    ],
  };
}
