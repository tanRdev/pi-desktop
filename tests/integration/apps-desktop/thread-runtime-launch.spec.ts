import { describe, expect, it } from "vitest";
import path from "node:path";
import { createThreadRuntimeLaunchDetails } from "../../../apps/desktop/src/main/thread-runtime-launch";
import { createTmuxThreadSessionName } from "../../../apps/desktop/src/main/tmux-session-naming";

describe("createThreadRuntimeLaunchDetails", () => {
  it("derives a stable socket path and tmux launch command for a thread runtime", () => {
    const launch = createThreadRuntimeLaunchDetails({
      threadId: "thread-alpha",
      worktreePath: "/tmp/worktrees/feature-alpha",
      mode: "mock",
      socketDirectory: "/tmp/pidesk-runtime-sockets",
      execPath: "/Applications/PiDesk.app/Contents/MacOS/PiDesk",
      sessionServerEntryPath: "/app/out/main/agent-host-session-server-entry.js",
      nodeEnv: "test",
    });

    const sessionName = createTmuxThreadSessionName("thread-alpha");
    expect(launch).toEqual({
      threadId: "thread-alpha",
      worktreePath: "/tmp/worktrees/feature-alpha",
      sessionName,
      socketPath: path.join("/tmp/pidesk-runtime-sockets", `${sessionName}.sock`),
      command: [
        "env",
        "ELECTRON_RUN_AS_NODE=1",
        `PIDESK_AGENT_SOCKET_PATH=${path.join("/tmp/pidesk-runtime-sockets", `${sessionName}.sock`)}`,
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
