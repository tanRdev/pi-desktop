import path from "node:path";
import { describe, expect, it } from "vitest";
import { createThreadRuntimeLaunchDetails } from "../../../apps/desktop/src/main/thread-runtime-launch";

describe("createThreadRuntimeLaunchDetails", () => {
  it("derives a stable socket path and local runtime command for a thread runtime", () => {
    const launch = createThreadRuntimeLaunchDetails({
      threadId: "thread-alpha",
      worktreePath: "/tmp/worktrees/feature-alpha",
      mode: "mock",
      socketDirectory: "/tmp/pidesk-runtime-sockets",
      execPath: "/Applications/PiDesk.app/Contents/MacOS/PiDesk",
      sessionServerEntryPath:
        "/app/out/main/agent-host-session-server-entry.js",
      nodeEnv: "test",
    });

    expect(launch).toEqual({
      threadId: "thread-alpha",
      worktreePath: "/tmp/worktrees/feature-alpha",
      runtimeId: "local-thread-alpha",
      socketPath: path.join("/tmp/pidesk-runtime-sockets", "pd-thread-a.sock"),
      command: [
        "env",
        "ELECTRON_RUN_AS_NODE=1",
        `PIDESK_AGENT_SOCKET_PATH=${path.join("/tmp/pidesk-runtime-sockets", "pd-thread-a.sock")}`,
        "PIDESK_AGENT_MODE=mock",
        "PIDESK_AGENT_CWD=/tmp/worktrees/feature-alpha",
        "PIDESK_AGENT_DIR=/tmp/worktrees/feature-alpha/.pi/agent",
        "NODE_ENV=test",
        "/Applications/PiDesk.app/Contents/MacOS/PiDesk",
        "/app/out/main/agent-host-session-server-entry.js",
      ],
    });
  });
});
