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
      resolveAgentRuntimeOptions({ NODE_ENV: "test" }, "/tmp/pidesk-workspace"),
    ).toEqual({
      mode: "mock",
      cwd: "/tmp/pidesk-workspace",
      agentDir: "/tmp/pidesk-workspace/.pidesk-agent",
    });
  });

  test("defaults to sdk mode outside tests", () => {
    expect(resolveAgentRuntimeOptions({}, "/tmp/pidesk-workspace")).toEqual({
      mode: "sdk",
      cwd: "/tmp/pidesk-workspace",
      agentDir: "/tmp/pidesk-workspace/.pidesk-agent",
    });
  });

  test("honors explicit runtime mode and path overrides", () => {
    expect(
      resolveAgentRuntimeOptions(
        {
          PIDESK_AGENT_MODE: "mock",
          PIDESK_AGENT_CWD: "/tmp/custom-workspace",
          PIDESK_AGENT_DIR: "/tmp/custom-agent-dir",
        },
        "/tmp/pidesk-workspace",
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
      "/tmp/pidesk-workspace",
    );

    expect(runtime).toBeTruthy();
    if (!runtime) {
      throw new Error("Expected a runtime instance");
    }
    expect(runtime.constructor.name).toBe("MockAgentRuntime");
  });

  test("creates the Pi SDK runtime outside test mode", () => {
    const runtime = createAgentRuntimeForEntry({}, "/tmp/pidesk-workspace");

    expect(runtime).toBeTruthy();
    if (!runtime) {
      throw new Error("Expected a runtime instance");
    }
    expect(runtime.constructor.name).toBe("PiSdkAgentRuntime");
  });

  test("honors explicit mock mode for packaged smoke tests", () => {
    const runtime = createAgentRuntimeForEntry(
      { PIDESK_AGENT_MODE: "mock" },
      "/tmp/pidesk-workspace",
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
        "/tmp/pidesk-user-data",
        true,
      ),
    ).toEqual({
      cwd: "/tmp/pidesk-user-data/workspace",
      env: expect.objectContaining({
        PIDESK_AGENT_MODE: "sdk",
        PIDESK_AGENT_CWD: "/tmp/pidesk-user-data/workspace",
        PIDESK_AGENT_DIR: "/tmp/pidesk-user-data/workspace/.pidesk-agent",
      }),
    });
  });

  test("keeps test launches pinned to the provided cwd", () => {
    expect(
      resolveAgentRuntimeLaunchOptions(
        { NODE_ENV: "test", PIDESK_AGENT_MODE: "mock" },
        "/tmp/pidesk-workspace",
        "/tmp/pidesk-user-data",
        false,
      ),
    ).toEqual({
      cwd: "/tmp/pidesk-workspace",
      env: expect.objectContaining({
        PIDESK_AGENT_MODE: "mock",
        PIDESK_AGENT_CWD: "/tmp/pidesk-workspace",
        PIDESK_AGENT_DIR: "/tmp/pidesk-workspace/.pidesk-agent",
      }),
    });
  });

  test("creates packaged workspace and agent directories before launch", () => {
    const createDirectory = vi.fn<(directory: string) => void>();

    const launchOptions = prepareAgentRuntimeLaunchOptions(
      {},
      "/tmp/random-cwd",
      "/tmp/pidesk-user-data",
      true,
      createDirectory,
    );

    expect(launchOptions).toEqual({
      cwd: "/tmp/pidesk-user-data/workspace",
      env: expect.objectContaining({
        PIDESK_AGENT_MODE: "sdk",
        PIDESK_AGENT_CWD: "/tmp/pidesk-user-data/workspace",
        PIDESK_AGENT_DIR: "/tmp/pidesk-user-data/workspace/.pidesk-agent",
      }),
    });
    expect(createDirectory).toHaveBeenNthCalledWith(
      1,
      "/tmp/pidesk-user-data/workspace",
    );
    expect(createDirectory).toHaveBeenNthCalledWith(
      2,
      "/tmp/pidesk-user-data/workspace/.pidesk-agent",
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
