type CliRpcSpawnRequest = {
  command: string;
  args: string[];
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    stdio: ["pipe", "pipe", "pipe"];
  };
};

type BuildCliRpcSpawnRequestOptions = {
  cwd: string;
  agentDir: string;
  sessionId: string;
  env: NodeJS.ProcessEnv;
};

function resolvePiCommand(env: NodeJS.ProcessEnv): string {
  const explicit = env.PI_CLI_PATH;
  if (explicit && typeof explicit === "string" && explicit.length > 0) {
    return explicit;
  }

  return "pi";
}

export function buildCliRpcSpawnRequest({
  cwd,
  agentDir,
  sessionId,
  env,
}: BuildCliRpcSpawnRequestOptions): CliRpcSpawnRequest {
  return {
    command: resolvePiCommand(env),
    args: ["--mode", "rpc", "--session-id", sessionId],
    options: {
      cwd,
      env: {
        ...env,
        PI_CODING_AGENT_DIR: agentDir,
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  };
}

export type { BuildCliRpcSpawnRequestOptions, CliRpcSpawnRequest };
