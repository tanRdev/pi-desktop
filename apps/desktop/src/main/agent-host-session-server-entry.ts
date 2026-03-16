import { startAgentHostSocketServer } from "@pidesk/agent-host";
import { createAgentRuntimeForEntry } from "./agent-host-runtime";

async function bootstrapSessionServer() {
  const socketPath = process.env.PIDESK_AGENT_SOCKET_PATH;

  if (!socketPath) {
    throw new Error("PiDesk agent session server requires PIDESK_AGENT_SOCKET_PATH");
  }

  const server = await startAgentHostSocketServer({
    socketPath,
    runtime: createAgentRuntimeForEntry(process.env, process.cwd()),
  });

  const shutdown = () => {
    void server.close().finally(() => {
      process.exit(0);
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void bootstrapSessionServer();
