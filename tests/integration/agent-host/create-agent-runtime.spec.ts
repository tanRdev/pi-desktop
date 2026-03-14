import { describe, expect, it, vi } from "vitest";

import { MockAgentRuntime } from "../../../packages/agent-host/src/mock/mock-agent-runtime";
import { PiSdkAgentRuntime } from "../../../packages/agent-host/src/pi/pi-sdk-agent-runtime";
import { createAgentRuntime } from "../../../packages/agent-host/src/runtime/create-agent-runtime";

describe("createAgentRuntime", () => {
  it("creates the mock runtime when mock mode is requested", () => {
    const runtime = createAgentRuntime({
      mode: "mock",
      cwd: "/tmp/pidesk-workspace",
    });

    expect(runtime).toBeInstanceOf(MockAgentRuntime);
  });

  it("creates the Pi SDK runtime when sdk mode is requested", () => {
    const runtime = createAgentRuntime({
      mode: "sdk",
      cwd: "/tmp/pidesk-workspace",
      createAgentSession: vi.fn(),
    });

    expect(runtime).toBeInstanceOf(PiSdkAgentRuntime);
  });
});
