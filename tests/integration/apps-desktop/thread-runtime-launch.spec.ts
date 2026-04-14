import path from "node:path";
import { describe, expect, it } from "vitest";
import { createThreadRuntimeLaunchDetails } from "../../../apps/desktop/src/main/thread-runtime-launch";

describe("createThreadRuntimeLaunchDetails", () => {
  it("derives a stable socket path and local runtime command for a thread runtime", () => {
    const launch = createThreadRuntimeLaunchDetails({
      threadId: "thread-alpha",
      worktreePath: "/tmp/worktrees/feature-alpha",
      mode: "mock",
      socketDirectory: "/tmp/pi-desktop-runtime-sockets",
      execPath: "/Applications/Pi Desktop.app/Contents/MacOS/Pi Desktop",
      sessionServerEntryPath:
        "/app/out/main/agent-host-session-server-entry.js",
      nodeEnv: "test",
    });

    expect(launch).toEqual({
      threadId: "thread-alpha",
      worktreePath: "/tmp/worktrees/feature-alpha",
      runtimeId: "local-thread-alpha",
      socketPath: path.join(
        "/tmp/pi-desktop-runtime-sockets",
        "pd-thread-a.sock",
      ),
      agentDirectory:
        "/tmp/worktrees/feature-alpha/.pi/agent/threads/thread-alpha",
      command: [
        "env",
        "ELECTRON_RUN_AS_NODE=1",
        `PI_DESKTOP_AGENT_SOCKET_PATH=${path.join("/tmp/pi-desktop-runtime-sockets", "pd-thread-a.sock")}`,
        "PI_DESKTOP_AGENT_MODE=mock",
        "PI_DESKTOP_AGENT_CWD=/tmp/worktrees/feature-alpha",
        "PI_DESKTOP_AGENT_DIR=/tmp/worktrees/feature-alpha/.pi/agent/threads/thread-alpha",
        "NODE_ENV=test",
        "/Applications/Pi Desktop.app/Contents/MacOS/Pi Desktop",
        "/app/out/main/agent-host-session-server-entry.js",
      ],
    });
  });
});
