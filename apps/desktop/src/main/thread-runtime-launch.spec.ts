import { describe, expect, it } from "vitest";

import { createThreadRuntimeLaunchDetails } from "./thread-runtime-launch";

describe("createThreadRuntimeLaunchDetails", () => {
  it("uses the shared Pi config and passes the desktop thread id to CLI mode", () => {
    const details = createThreadRuntimeLaunchDetails({
      threadId: "thread-123",
      worktreePath: "/repo",
      mode: "cli",
      socketDirectory: "/tmp/pd",
      execPath: "/electron",
      sessionServerEntryPath: "/agent-host.js",
      agentDirectory: "/Users/test/.pi/agent",
    });

    expect(details.agentDirectory).toBe("/Users/test/.pi/agent");
    expect(details.command).toContain(
      "PI_DESKTOP_AGENT_DIR=/Users/test/.pi/agent",
    );
    expect(details.command).toContain("PI_DESKTOP_THREAD_ID=thread-123");
  });
});
