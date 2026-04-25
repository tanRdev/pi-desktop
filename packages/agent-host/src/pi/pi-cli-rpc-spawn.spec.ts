import { describe, expect, it } from "vitest";

import { buildCliRpcSpawnRequest } from "./pi-cli-rpc-spawn.js";

describe("buildCliRpcSpawnRequest", () => {
  it("prefers PI_CLI_PATH and assembles the cli rpc spawn request", () => {
    const env = {
      PATH: "/usr/bin",
      PI_CLI_PATH: "/opt/pi/bin/pi",
      PI_CODING_AGENT_DIR: "/tmp/stale-agent-dir",
    };

    expect(
      buildCliRpcSpawnRequest({
        cwd: "/tmp/pi-desktop-workspace",
        agentDir: "/tmp/pi-desktop-agent",
        env,
      }),
    ).toEqual({
      command: "/opt/pi/bin/pi",
      args: ["--mode", "rpc", "--continue"],
      options: {
        cwd: "/tmp/pi-desktop-workspace",
        env: {
          PATH: "/usr/bin",
          PI_CLI_PATH: "/opt/pi/bin/pi",
          PI_CODING_AGENT_DIR: "/tmp/pi-desktop-agent",
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    });

    expect(env).toEqual({
      PATH: "/usr/bin",
      PI_CLI_PATH: "/opt/pi/bin/pi",
      PI_CODING_AGENT_DIR: "/tmp/stale-agent-dir",
    });
  });

  it("falls back to the PATH pi command when PI_CLI_PATH is blank", () => {
    expect(
      buildCliRpcSpawnRequest({
        cwd: "/tmp/pi-desktop-workspace",
        agentDir: "/tmp/pi-desktop-agent",
        env: {
          PI_CLI_PATH: "",
        },
      }).command,
    ).toBe("pi");
  });
});
