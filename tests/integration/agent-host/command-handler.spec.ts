import { describe, expect, it, vi } from "vitest";
import { createAgentHostCommandHandler } from "../../../packages/agent-host/src/utility-process/command-handler";
import type { AgentSnapshot } from "../../../packages/shared/src";

describe("createAgentHostCommandHandler", () => {
  it("returns snapshots and prompt acknowledgements for protocol requests", async () => {
    const snapshot: AgentSnapshot = {
      sessionId: "mock-session",
      status: "ready",
      messages: [],
      lastError: null,
    };

    const runtime = {
      bootstrap: vi.fn(async () => undefined),
      getProviders: vi.fn(async () => []),
      getSettings: vi.fn(async () => ({})),
      getSnapshot: vi.fn(() => snapshot),
      prompt: vi.fn(async () => undefined),
      cancelPrompt: vi.fn(async () => undefined),
      reset: vi.fn(async () => undefined),
    };

    const handleCommand = createAgentHostCommandHandler(runtime);

    await expect(
      handleCommand({ requestId: "1", type: "bootstrap" }),
    ).resolves.toEqual({
      type: "response",
      response: {
        requestId: "1",
        kind: "ack",
      },
    });

    await expect(
      handleCommand({ requestId: "2", type: "getSnapshot" }),
    ).resolves.toEqual({
      type: "response",
      response: {
        requestId: "2",
        kind: "snapshot",
        snapshot,
      },
    });

    await expect(
      handleCommand({
        requestId: "3",
        type: "prompt",
        text: "Explain the open files",
      }),
    ).resolves.toEqual({
      type: "response",
      response: {
        requestId: "3",
        kind: "ack",
      },
    });

    await expect(
      handleCommand({ requestId: "4", type: "cancelPrompt" }),
    ).resolves.toEqual({
      type: "response",
      response: {
        requestId: "4",
        kind: "ack",
      },
    });

    expect(runtime.bootstrap).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot).toHaveBeenCalledTimes(1);
    expect(runtime.prompt).toHaveBeenCalledWith("Explain the open files");
    expect(runtime.cancelPrompt).toHaveBeenCalledTimes(1);
  });

  it("returns error responses when runtime commands fail", async () => {
    const runtime = {
      bootstrap: vi.fn(async () => {
        throw new Error("Missing SDK auth");
      }),
      getProviders: vi.fn(async () => []),
      getSettings: vi.fn(async () => ({})),
      getSnapshot: vi.fn(() => {
        throw new Error("Snapshot unavailable");
      }),
      prompt: vi.fn(async () => {
        throw new Error("Provider request failed");
      }),
      cancelPrompt: vi.fn(async () => {
        throw new Error("No prompt is running");
      }),
      reset: vi.fn(async () => undefined),
    };

    const handleCommand = createAgentHostCommandHandler(runtime);

    await expect(
      handleCommand({ requestId: "1", type: "bootstrap" }),
    ).resolves.toEqual({
      type: "response",
      response: {
        requestId: "1",
        kind: "error",
        message: "Missing SDK auth",
      },
    });

    await expect(
      handleCommand({
        requestId: "2",
        type: "prompt",
        text: "Explain the open files",
      }),
    ).resolves.toEqual({
      type: "response",
      response: {
        requestId: "2",
        kind: "error",
        message: "Provider request failed",
      },
    });

    await expect(
      handleCommand({ requestId: "3", type: "cancelPrompt" }),
    ).resolves.toEqual({
      type: "response",
      response: {
        requestId: "3",
        kind: "error",
        message: "No prompt is running",
      },
    });
  });
});
