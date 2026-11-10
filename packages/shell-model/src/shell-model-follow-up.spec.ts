import type {
  AgentSnapshot,
  FollowUpQueueState,
  PiDesktopAgentEvent,
  PiDesktopApi,
  PromptImageAttachment,
  ShellSnapshot,
} from "@pi-desktop/shared";
import { describe, expect, it, vi } from "vitest";
import type { FollowUpQueueStorage } from "./follow-up-queue-persistence";
import { createShellModel } from "./shell-model";

const THREAD_ID = "thread-1";
const IMAGE: PromptImageAttachment = {
  type: "image",
  mimeType: "image/png",
  data: "aGVsbG8=",
  name: "shot.png",
};

function createShellFixture(): ShellSnapshot {
  return {
    appName: "Pi Desktop",
    appVersion: "0.1.0",
    chromeVersion: "141.0.0.0",
    platform: "darwin",
    mode: "test",
    catalog: {
      repositories: [],
      selection: {
        repositoryId: "repo-1",
        worktreeId: "wt-1",
        threadId: THREAD_ID,
      },
    },
    capabilities: {
      supportsTurns: true,
      supportsTools: true,
      supportsActivity: true,
      supportsParallelSessions: false,
      supportsSteer: true,
      supportsImageAttachments: true,
    },
  } as ShellSnapshot;
}

interface Harness {
  api: PiDesktopApi;
  prompt: ReturnType<typeof vi.fn>;
  steer: ReturnType<typeof vi.fn>;
  emit: (event: PiDesktopAgentEvent) => void;
  setAgentStatus: (status: AgentSnapshot["status"]) => void;
}

function createHarness(
  initialStatus: AgentSnapshot["status"] = "ready",
): Harness {
  let listener: ((event: PiDesktopAgentEvent) => void) | undefined;
  let agentStatus = initialStatus;

  const prompt = vi.fn(async () => undefined);
  const steer = vi.fn(async () => undefined);

  const api = {
    shell: {
      getSnapshot: vi.fn(async () => createShellFixture()),
    },
    agent: {
      getSnapshot: vi.fn(
        async (): Promise<AgentSnapshot> => ({
          sessionId: "session-1",
          status: agentStatus,
          messages: [],
          lastError: null,
        }),
      ),
      prompt,
      steer,
      cancelPrompt: vi.fn(async () => undefined),
      reset: vi.fn(async () => undefined),
      getProviders: vi.fn(async () => []),
      getSettings: vi.fn(async () => ({})),
      getOAuthProviders: vi.fn(async () => []),
      loginWithOAuth: vi.fn(async () => undefined),
      logoutOAuth: vi.fn(async () => undefined),
      onOAuthPrompt: vi.fn(() => () => {}),
      respondOAuthPrompt: vi.fn(async () => undefined),
      switchModel: vi.fn(async () => ({ mode: "live" as const })),
      getDiscovery: vi.fn(async () => ({
        isInstalled: true,
        skills: [],
        commands: [],
      })),
      getSlashSuggestions: vi.fn(async () => ({
        kind: "slash" as const,
        suggestions: [],
        hasMore: false,
      })),
      subscribe: vi.fn((next: (event: PiDesktopAgentEvent) => void) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      }),
    },
  } as unknown as PiDesktopApi;

  return {
    api,
    prompt,
    steer,
    emit: (event) => listener?.(event),
    setAgentStatus: (status) => {
      agentStatus = status;
    },
  };
}

async function flushDispatch(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function createModel(harness: Harness, storage?: FollowUpQueueStorage) {
  let idCounter = 0;
  return createShellModel(harness.api, {
    followUpStorage: storage,
    createFollowUpId: () => {
      idCounter += 1;
      return `fu-${idCounter}`;
    },
    now: () => 1000,
  });
}

describe("shell model follow-up queue dispatch", () => {
  it("queues while a run is active and dispatches in order, exactly once, when it finishes", async () => {
    const harness = createHarness("streaming");
    const model = createModel(harness);
    await model.load();

    harness.emit({ type: "agent_start" });
    const firstId = model.enqueueFollowUp("first follow-up");
    const secondId = model.enqueueFollowUp("second follow-up");
    expect(firstId).toBe("fu-1");
    expect(secondId).toBe("fu-2");
    expect(harness.prompt).not.toHaveBeenCalled();
    expect(
      model.getState().followUpQueues[THREAD_ID]?.items.map((i) => i.status),
    ).toEqual(["queued", "queued"]);

    harness.setAgentStatus("ready");
    harness.emit({ type: "agent_end" });
    await flushDispatch();

    expect(harness.prompt.mock.calls.map((call) => call[0])).toEqual([
      "first follow-up",
      "second follow-up",
    ]);
    expect(
      model.getState().followUpQueues[THREAD_ID]?.items.map((i) => i.status),
    ).toEqual(["sent", "sent"]);

    // A duplicate agent_end must not redeliver sent items.
    harness.emit({ type: "agent_end" });
    await flushDispatch();
    expect(harness.prompt).toHaveBeenCalledTimes(2);
    model.dispose();
  });

  it("dispatches immediately when enqueued while the agent is idle", async () => {
    const harness = createHarness("ready");
    const model = createModel(harness);
    await model.load();

    model.enqueueFollowUp("right away");
    await flushDispatch();

    expect(harness.prompt).toHaveBeenCalledTimes(1);
    expect(harness.prompt).toHaveBeenCalledWith("right away");
    expect(model.getState().followUpQueues[THREAD_ID]?.items[0]?.status).toBe(
      "sent",
    );
    model.dispose();
  });

  it("carries typed image attachments through dispatch", async () => {
    const harness = createHarness("streaming");
    const model = createModel(harness);
    await model.load();

    harness.emit({ type: "agent_start" });
    model.enqueueFollowUp("describe this", [IMAGE]);
    harness.setAgentStatus("ready");
    harness.emit({ type: "agent_end" });
    await flushDispatch();

    expect(harness.prompt).toHaveBeenCalledWith("describe this", [IMAGE]);
    model.dispose();
  });

  it("preserves a failed item with its context and blocks later items until retried", async () => {
    const harness = createHarness("streaming");
    harness.prompt.mockRejectedValueOnce(new Error("runtime offline"));
    const model = createModel(harness);
    await model.load();

    harness.emit({ type: "agent_start" });
    model.enqueueFollowUp("will fail", [IMAGE]);
    model.enqueueFollowUp("waits behind failure");
    harness.setAgentStatus("ready");
    harness.emit({ type: "agent_end" });
    await flushDispatch();

    const queue = model.getState().followUpQueues[THREAD_ID];
    expect(queue?.items.map((item) => item.status)).toEqual([
      "failed",
      "queued",
    ]);
    expect(queue?.items[0]).toMatchObject({
      text: "will fail",
      images: [IMAGE],
      lastError: "runtime offline",
      attempts: 1,
    });
    expect(harness.prompt).toHaveBeenCalledTimes(1);

    const failedId = queue?.items[0]?.id ?? "";
    model.retryFollowUp(THREAD_ID, failedId);
    await flushDispatch();

    expect(harness.prompt.mock.calls.map((call) => call[0])).toEqual([
      "will fail",
      "will fail",
      "waits behind failure",
    ]);
    expect(
      model.getState().followUpQueues[THREAD_ID]?.items.map((i) => i.status),
    ).toEqual(["sent", "sent"]);
    model.dispose();
  });

  it("holds dispatch while paused and resumes on unpause", async () => {
    const harness = createHarness("streaming");
    const model = createModel(harness);
    await model.load();

    harness.emit({ type: "agent_start" });
    model.enqueueFollowUp("held");
    model.setFollowUpPaused(THREAD_ID, true);
    harness.setAgentStatus("ready");
    harness.emit({ type: "agent_end" });
    await flushDispatch();
    expect(harness.prompt).not.toHaveBeenCalled();

    model.setFollowUpPaused(THREAD_ID, false);
    await flushDispatch();
    expect(harness.prompt).toHaveBeenCalledTimes(1);
    expect(harness.prompt).toHaveBeenCalledWith("held");
    model.dispose();
  });

  it("supports edit, reorder, and delete through the model API", async () => {
    const harness = createHarness("streaming");
    const model = createModel(harness);
    await model.load();

    model.setFollowUpPaused(THREAD_ID, true);
    const first = model.enqueueFollowUp("alpha") ?? "";
    const second = model.enqueueFollowUp("beta") ?? "";
    model.enqueueFollowUp("gamma");

    model.editFollowUp(THREAD_ID, second, "beta edited");
    model.moveFollowUp(THREAD_ID, second, -1);
    model.deleteFollowUp(THREAD_ID, first);

    const queue = model.getState().followUpQueues[THREAD_ID];
    expect(queue?.items.map((item) => item.text)).toEqual([
      "beta edited",
      "gamma",
    ]);
    model.dispose();
  });

  it("persists queue changes through the storage adapter and rehydrates them", async () => {
    let stored: Record<string, FollowUpQueueState> = {};
    const storage: FollowUpQueueStorage = {
      read: () => stored,
      write: (queues) => {
        stored = queues;
      },
    };

    const harness = createHarness("streaming");
    const model = createModel(harness, storage);
    await model.load();
    harness.emit({ type: "agent_start" });
    model.enqueueFollowUp("survives reload", [IMAGE]);

    expect(stored[THREAD_ID]?.items[0]).toMatchObject({
      text: "survives reload",
      status: "queued",
    });
    model.dispose();

    const harness2 = createHarness("streaming");
    const model2 = createModel(harness2, storage);
    expect(model2.getState().followUpQueues[THREAD_ID]?.items).toHaveLength(1);
    await model2.load();
    expect(harness2.prompt).not.toHaveBeenCalled();
    expect(model2.getState().followUpQueues[THREAD_ID]?.items[0]?.status).toBe(
      "queued",
    );
    model2.dispose();
  });

  it("forwards steer to the runtime without cancelling the active run", async () => {
    const harness = createHarness("streaming");
    const model = createModel(harness);
    await model.load();

    harness.emit({ type: "agent_start" });
    await model.steerPrompt("focus on the parser");
    expect(harness.steer).toHaveBeenCalledTimes(1);
    expect(harness.steer).toHaveBeenCalledWith("focus on the parser");
    expect(model.getState().agent.status).toBe("streaming");

    await model.steerPrompt("with image", [IMAGE]);
    expect(harness.steer).toHaveBeenCalledWith("with image", [IMAGE]);
    model.dispose();
  });

  it("does not enqueue without an active thread or with empty text", async () => {
    const harness = createHarness("ready");
    const model = createModel(harness);
    // No load(): no shell snapshot, so no active thread is selected.
    expect(model.enqueueFollowUp("nowhere")).toBeNull();
    await model.load();
    expect(model.enqueueFollowUp("   ")).toBeNull();
    expect(model.getState().followUpQueues[THREAD_ID]).toBeUndefined();
    model.dispose();
  });
});
