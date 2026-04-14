import { describe, expect, it, vi } from "vitest";

import { MockAgentRuntime } from "../../../packages/agent-host/src/mock/mock-agent-runtime";
import { PiCliRpcAgentRuntime } from "../../../packages/agent-host/src/pi/pi-cli-rpc-agent-runtime";
import { PiSdkAgentRuntime } from "../../../packages/agent-host/src/pi/pi-sdk-agent-runtime";
import { createAgentRuntime } from "../../../packages/agent-host/src/runtime/create-agent-runtime";

describe("createAgentRuntime", () => {
  it("creates the mock runtime when mock mode is requested", () => {
    const runtime = createAgentRuntime({
      mode: "mock",
      cwd: "/tmp/pi-desktop-workspace",
    });

    expect(runtime).toBeInstanceOf(MockAgentRuntime);
  });

  it("creates the Pi SDK runtime when sdk mode is requested", () => {
    const runtime = createAgentRuntime({
      mode: "sdk",
      cwd: "/tmp/pi-desktop-workspace",
      createAgentSession: vi.fn(),
    });

    expect(runtime).toBeInstanceOf(PiSdkAgentRuntime);
  });

  it("creates the Pi CLI RPC runtime when cli mode is requested", () => {
    const runtime = createAgentRuntime({
      mode: "cli",
      cwd: "/tmp/pi-desktop-workspace",
      agentDir: "/tmp/pi-desktop-workspace/.pi/agent",
    });

    expect(runtime).toBeInstanceOf(PiCliRpcAgentRuntime);
  });
});
