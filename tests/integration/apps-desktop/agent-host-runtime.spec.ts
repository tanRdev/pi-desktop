import { describe, expect, test, vi } from "vitest";
import {
  createAgentRuntimeForEntry,
  createUnavailableAgentHost,
  prepareAgentRuntimeLaunchOptions,
  resolveAgentRuntimeLaunchOptions,
  resolveAgentRuntimeOptions,
} from "../../../apps/desktop/src/main/agent-host-runtime";

describe("resolveAgentRuntimeOptions", () => {
  test("defaults to mock mode in test environments", () => {
    expect(
      resolveAgentRuntimeOptions({ NODE_ENV: "test" }, "/tmp/pi-desktop-workspace"),
    ).toEqual({
      mode: "mock",
      cwd: "/tmp/pi-desktop-workspace",
      agentDir: "/tmp/pi-desktop-workspace/.pi/agent",
    });
  });

  test("defaults to sdk mode outside tests", () => {
    expect(resolveAgentRuntimeOptions({}, "/tmp/pi-desktop-workspace")).toEqual({
      mode: "cli",
      cwd: "/tmp/pi-desktop-workspace",
      agentDir: "/tmp/pi-desktop-workspace/.pi/agent",
    });
  });

  test("honors explicit runtime mode and path overrides", () => {
    expect(
      resolveAgentRuntimeOptions(
        {
          PI_DESKTOP_AGENT_MODE: "mock",
          PI_DESKTOP_AGENT_CWD: "/tmp/custom-workspace",
          PI_DESKTOP_AGENT_DIR: "/tmp/custom-agent-dir",
        },
        "/tmp/pi-desktop-workspace",
      ),
    ).toEqual({
      mode: "mock",
      cwd: "/tmp/custom-workspace",
      agentDir: "/tmp/custom-agent-dir",
    });
  });
});

describe("createAgentRuntimeForEntry", () => {
  test("creates the mock runtime in test mode", () => {
    const runtime = createAgentRuntimeForEntry(
      { NODE_ENV: "test" },
      "/tmp/pi-desktop-workspace",
    );

    expect(runtime).toBeTruthy();
    if (!runtime) {
      throw new Error("Expected a runtime instance");
    }
    expect(runtime.constructor.name).toBe("MockAgentRuntime");
  });

  test("creates the Pi CLI runtime outside test mode", () => {
    const runtime = createAgentRuntimeForEntry({}, "/tmp/pi-desktop-workspace");

    expect(runtime).toBeTruthy();
    if (!runtime) {
      throw new Error("Expected a runtime instance");
    }
    expect(runtime.constructor.name).toBe("PiCliRpcAgentRuntime");
  });

  test("honors explicit mock mode for packaged smoke tests", () => {
    const runtime = createAgentRuntimeForEntry(
      { PI_DESKTOP_AGENT_MODE: "mock" },
      "/tmp/pi-desktop-workspace",
    );

    expect(runtime).toBeTruthy();
    if (!runtime) {
      throw new Error("Expected a runtime instance");
    }
    expect(runtime.constructor.name).toBe("MockAgentRuntime");
  });
});

describe("resolveAgentRuntimeLaunchOptions", () => {
  test("pins packaged launches to a stable user-data workspace by default", () => {
    expect(
      resolveAgentRuntimeLaunchOptions(
        {},
        "/tmp/random-cwd",
        "/tmp/pi-desktop-user-data",
        true,
        "/tmp/pi-desktop-home",
      ),
    ).toEqual({
      cwd: "/tmp/pi-desktop-home",
      env: expect.objectContaining({
        PI_DESKTOP_AGENT_MODE: "cli",
        PI_DESKTOP_AGENT_CWD: "/tmp/pi-desktop-home",
        PI_DESKTOP_AGENT_DIR: "/tmp/pi-desktop-home/.pi/agent",
      }),
    });
  });

  test("keeps test launches pinned to the provided cwd", () => {
    expect(
      resolveAgentRuntimeLaunchOptions(
        { NODE_ENV: "test", PI_DESKTOP_AGENT_MODE: "mock" },
        "/tmp/pi-desktop-workspace",
        "/tmp/pi-desktop-user-data",
        false,
        "/tmp/pi-desktop-home",
      ),
    ).toEqual({
      cwd: "/tmp/pi-desktop-workspace",
      env: expect.objectContaining({
        PI_DESKTOP_AGENT_MODE: "mock",
        PI_DESKTOP_AGENT_CWD: "/tmp/pi-desktop-workspace",
        PI_DESKTOP_AGENT_DIR: "/tmp/pi-desktop-workspace/.pi/agent",
      }),
    });
  });

  test("creates packaged workspace and agent directories before launch", () => {
    const createDirectory = vi.fn<(directory: string) => void>();

    const launchOptions = prepareAgentRuntimeLaunchOptions(
      {},
      "/tmp/random-cwd",
      "/tmp/pi-desktop-user-data",
      true,
      "/tmp/pi-desktop-home",
      createDirectory,
    );

    expect(launchOptions).toEqual({
      cwd: "/tmp/pi-desktop-home",
      env: expect.objectContaining({
        PI_DESKTOP_AGENT_MODE: "cli",
        PI_DESKTOP_AGENT_CWD: "/tmp/pi-desktop-home",
        PI_DESKTOP_AGENT_DIR: "/tmp/pi-desktop-home/.pi/agent",
      }),
    });
    expect(createDirectory).toHaveBeenNthCalledWith(1, "/tmp/pi-desktop-home");
    expect(createDirectory).toHaveBeenNthCalledWith(
      2,
      "/tmp/pi-desktop-home/.pi/agent",
    );
  });
});

describe("createUnavailableAgentHost", () => {
  test("returns an error snapshot and rejects prompts", async () => {
    const host = createUnavailableAgentHost("Missing SDK auth");

    await expect(host.getSnapshot()).resolves.toMatchObject({
      sessionId: "",
      status: "error",
      lastError: "Missing SDK auth",
    });
    await expect(host.prompt("Explain the workspace")).rejects.toThrow(
      "Missing SDK auth",
    );
  });
});
