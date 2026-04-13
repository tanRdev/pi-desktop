import { describe, expect, test, vi } from "vitest";
import type {
  AgentSnapshot,
  PiDeskAgentEvent,
  ShellSnapshot,
} from "../../../packages/shared/src";
import { createShellModel } from "../../../packages/shell-model/src";

type ShellModelApi = Parameters<typeof createShellModel>[0];
type ShellModelStateApi = {
  getRepositoryPreferences: ReturnType<typeof vi.fn>;
  updateRepositoryPreferences: ReturnType<typeof vi.fn>;
  getWorkspaceSession: ReturnType<typeof vi.fn>;
  saveWorkspaceSession: ReturnType<typeof vi.fn>;
  getAppPreferences: ReturnType<typeof vi.fn>;
  updateAppPreferences: ReturnType<typeof vi.fn>;
  importLegacyPreferences: ReturnType<typeof vi.fn>;
};

type LegacyMessageEnvelopeEvent = {
  type: "message_end" | "message_start" | "message_update";
  message: {
    id: string;
    role: "assistant" | "system" | "tool" | "user";
    text: string;
    status: "complete" | "error" | "streaming";
    timestamp?: number;
  };
  delta?: string;
};

function createShellSnapshotFixture(): ShellSnapshot {
  return {
    appName: "PiDesk",
    appVersion: "0.1.0",
    chromeVersion: "141.0.0.0",
    platform: "darwin",
    mode: "test" as const,
    runtime: {
      agentMode: "mock" as const,
      electronVersion: "41.0.1",
      agentDirectory: "/tmp/pidesk/.pidesk-agent",
    },
    workspace: {
      rootPath: "/tmp/pidesk",
      agentDirectory: "/tmp/pidesk/.pidesk-agent",
      projects: [
        {
          id: "/tmp/pidesk",
          name: "pidesk",
          path: "/tmp/pidesk",
          isActive: true,
        },
      ],
    },
    catalog: {
      selection: {
        repositoryId: "/tmp/pidesk",
        worktreeId: "/tmp/pidesk",
        threadId: "default-thread",
      },
      repositories: [
        {
          id: "/tmp/pidesk",
          name: "pidesk",
          rootPath: "/tmp/pidesk",
          defaultBranch: "main",
          worktrees: [
            {
              id: "/tmp/pidesk",
              label: "main",
              path: "/tmp/pidesk",
              isMain: true,
              isDetached: false,
              git: {
                status: "ready",
                branch: "main",
                commit: "abc1234",
                hasChanges: false,
                ahead: 0,
                behind: 0,
                stagedCount: 0,
                modifiedCount: 0,
                untrackedCount: 0,
                message: null,
              },
              threads: [
                {
                  id: "default-thread",
                  title: "North Star",
                  isArchived: false,
                  lastActivityAt: null,
                  runtime: {
                    status: "ready",
                    lastError: null,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    capabilities: {
      supportsTurns: true,
      supportsTools: true,
      supportsActivity: true,
      supportsParallelSessions: false,
    },
  };
}

function createAgentSnapshotFixture(
  overrides: Partial<AgentSnapshot> = {},
): AgentSnapshot {
  return {
    sessionId: "mock-session",
    status: "ready",
    messages: [],
    lastError: null,
    ...overrides,
  };
}

function createStateApiFixture(): ShellModelStateApi {
  return {
    getRepositoryPreferences: vi.fn(async () => null),
    updateRepositoryPreferences: vi.fn(async () => ({
      repositoryId: "/tmp/pidesk",
      customName: null,
      icon: null,
      accentColor: null,
    })),
    getWorkspaceSession: vi.fn(async () => null),
    saveWorkspaceSession: vi.fn(async (session) => session),
    getAppPreferences: vi.fn(async () => ({})),
    updateAppPreferences: vi.fn(async (updates) => updates),
    importLegacyPreferences: vi.fn(async () => ({
      repositoryPreferences: [],
      appPreferences: {},
    })),
  };
}

describe("createShellModel", () => {
  test("loads snapshots and folds live agent events into renderer state", async () => {
    let eventListener:
      | ((event: PiDeskAgentEvent | LegacyMessageEnvelopeEvent) => void)
      | undefined;
    const api = {
      shell: {
        getSnapshot: vi.fn(async () => createShellSnapshotFixture()),
      },
      agent: {
        getSnapshot: vi.fn(async () => createAgentSnapshotFixture()),
        prompt: vi.fn(async () => {}),
        reset: vi.fn(async () => {}),
        subscribe: vi.fn((listener) => {
          eventListener = listener as unknown as typeof eventListener;
          return () => {
            eventListener = undefined;
          };
        }),
      },
      state: createStateApiFixture(),
    } as unknown as ShellModelApi;

    const model = createShellModel(api);
    await model.load();

    expect(model.getState().shell.appName).toBe("PiDesk");
    expect(model.getState().agent.status).toBe("ready");
    expect(eventListener).toBeTypeOf("function");

    eventListener?.({
      type: "message_start",
      message: {
        id: "assistant-1",
        role: "assistant",
        text: "",
        status: "streaming",
        timestamp: 1,
      },
    });
    eventListener?.({
      type: "message_update",
      message: {
        id: "assistant-1",
        role: "assistant",
        text: "PiDesk mock assistant received: hello",
        status: "streaming",
        timestamp: 2,
      },
      delta: "hello",
    });
    eventListener?.({
      type: "message_end",
      message: {
        id: "assistant-1",
        role: "assistant",
        text: "PiDesk mock assistant received: hello",
        status: "complete",
        timestamp: 3,
      },
    });

    expect(model.getState().agent.messages).toEqual([
      {
        id: "assistant-1",
        role: "assistant",
        text: "PiDesk mock assistant received: hello",
        status: "complete",
        timestamp: 3,
      },
    ]);

    model.dispose();
    expect(eventListener).toBeUndefined();
  });

  test("refreshes shell and agent snapshots when the active session changes", async () => {
    let eventListener: ((event: PiDeskAgentEvent) => void) | undefined;
    const shellSnapshot = createShellSnapshotFixture();
    const nextShellSnapshot = {
      ...createShellSnapshotFixture(),
      catalog: {
        ...createShellSnapshotFixture().catalog,
        selection: {
          repositoryId: "/tmp/other-repo",
          worktreeId: "/tmp/other-repo",
          threadId: "thread-other",
        },
      },
    };
    const initialAgentSnapshot = createAgentSnapshotFixture({
      sessionId: "session-initial",
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          text: "old transcript",
          status: "complete",
          timestamp: 1,
        },
      ],
    });
    const nextAgentSnapshot = createAgentSnapshotFixture({
      sessionId: "session-other",
      status: "ready",
      messages: [],
    });
    const api = {
      shell: {
        getSnapshot: vi
          .fn<() => Promise<ShellSnapshot>>()
          .mockResolvedValueOnce(shellSnapshot)
          .mockResolvedValueOnce(nextShellSnapshot),
      },
      agent: {
        getSnapshot: vi
          .fn<() => Promise<AgentSnapshot>>()
          .mockResolvedValueOnce(initialAgentSnapshot)
          .mockResolvedValueOnce(nextAgentSnapshot),
        prompt: vi.fn(async () => {}),
        reset: vi.fn(async () => {}),
        subscribe: vi.fn((listener) => {
          eventListener = listener;
          return () => {
            eventListener = undefined;
          };
        }),
      },
      state: createStateApiFixture(),
    } as unknown as ShellModelApi;

    const model = createShellModel(api);
    await model.load();

    eventListener?.({ type: "session_changed" });
    await Promise.resolve();
    await Promise.resolve();

    expect(model.getState().shell.catalog.selection).toEqual(
      nextShellSnapshot.catalog.selection,
    );
    expect(model.getState().agent).toEqual(nextAgentSnapshot);

    model.dispose();
  });

  test("notifies renderer subscribers when live turn and tool events arrive", async () => {
    let eventListener: ((event: PiDeskAgentEvent) => void) | undefined;
    const api = {
      shell: {
        getSnapshot: vi.fn(async () => createShellSnapshotFixture()),
      },
      agent: {
        getSnapshot: vi.fn(async () => createAgentSnapshotFixture()),
        prompt: vi.fn(async () => {}),
        subscribe: vi.fn((listener) => {
          eventListener = listener;
          return () => {
            eventListener = undefined;
          };
        }),
      },
      state: createStateApiFixture(),
    } as unknown as ShellModelApi;

    const model = createShellModel(api);
    const listener = vi.fn();
    const unsubscribe = model.subscribe(listener);

    await model.load();
    listener.mockClear();

    eventListener?.({ type: "turn_start" });
    eventListener?.({
      type: "tool_execution_start",
      toolCallId: "tool-1",
      toolName: "workspace.inspect",
      args: { prompt: "Summarize the workspace" },
    });
    eventListener?.({
      type: "tool_execution_end",
      toolCallId: "tool-1",
      toolName: "workspace.inspect",
      result: { status: "ok" },
      isError: false,
    });

    expect(listener).toHaveBeenCalled();
    expect(model.getState().live.turns).toEqual([
      {
        id: "turn-1",
        status: "running",
        startedAt: expect.any(Number),
        endedAt: null,
        messageIds: [],
        toolCallIds: ["tool-1"],
      },
    ]);
    expect(model.getState().live.toolsById["tool-1"]).toMatchObject({
      toolCallId: "tool-1",
      turnId: "turn-1",
      toolName: "workspace.inspect",
      status: "complete",
      result: { status: "ok" },
      isError: false,
    });

    unsubscribe();
    model.dispose();
  });

  test("sends trimmed prompts and clears the draft after sending", async () => {
    const prompt = vi.fn(async () => {});
    const api = {
      shell: {
        getSnapshot: vi.fn(async () => createShellSnapshotFixture()),
      },
      agent: {
        getSnapshot: vi.fn(async () => createAgentSnapshotFixture()),
        prompt,
        cancelPrompt: vi.fn(async () => undefined),
        subscribe: vi.fn(() => () => {}),
      },
      state: createStateApiFixture(),
    } as unknown as ShellModelApi;

    const model = createShellModel(api);
    model.setDraft("  Summarize the workspace  ");
    await model.sendPrompt();

    expect(prompt).toHaveBeenCalledWith("Summarize the workspace");
    expect(model.getState().draft).toBe("");
  });

  test("refreshes the agent snapshot after sending a prompt", async () => {
    const snapshot: AgentSnapshot = {
      sessionId: "mock-session",
      status: "ready",
      messages: [],
      lastError: null,
    };
    const prompt = vi.fn(async (text: string) => {
      snapshot.messages = [
        {
          id: "user-1",
          role: "user" as const,
          text,
          status: "complete" as const,
          timestamp: 1,
        },
        {
          id: "assistant-1",
          role: "assistant" as const,
          text: `PiDesk mock assistant received: ${text}`,
          status: "complete" as const,
          timestamp: 2,
        },
      ];
    });

    const api = {
      shell: {
        getSnapshot: vi.fn(async () => createShellSnapshotFixture()),
      },
      agent: {
        getSnapshot: vi.fn(async () => ({
          ...snapshot,
          messages: [...snapshot.messages],
        })),
        prompt,
        cancelPrompt: vi.fn(async () => undefined),
        subscribe: vi.fn(() => () => {}),
      },
      state: createStateApiFixture(),
    } as unknown as ShellModelApi;

    const model = createShellModel(api);
    await model.load();
    model.setDraft("Summarize the current workspace");

    await model.sendPrompt();

    expect(prompt).toHaveBeenCalledWith("Summarize the current workspace");
    expect(model.getState().agent.messages).toEqual([
      {
        id: "user-1",
        role: "user",
        text: "Summarize the current workspace",
        status: "complete",
        timestamp: 1,
      },
      {
        id: "assistant-1",
        role: "assistant",
        text: "PiDesk mock assistant received: Summarize the current workspace",
        status: "complete",
        timestamp: 2,
      },
    ]);
  });

  test("refreshes the agent snapshot after a prompt failure", async () => {
    const snapshot: AgentSnapshot = {
      sessionId: "sdk-session",
      status: "ready",
      messages: [],
      lastError: null,
    };
    const prompt = vi.fn(async () => {
      snapshot.status = "error";
      snapshot.lastError = "Missing SDK auth";
      throw new Error("Missing SDK auth");
    });

    const api = {
      shell: {
        getSnapshot: vi.fn(async () => createShellSnapshotFixture()),
      },
      agent: {
        getSnapshot: vi.fn(async () => ({
          ...snapshot,
          messages: [...snapshot.messages],
        })),
        prompt,
        cancelPrompt: vi.fn(async () => undefined),
        subscribe: vi.fn(() => () => {}),
      },
      state: createStateApiFixture(),
    } as unknown as ShellModelApi;

    const model = createShellModel(api);
    await model.load();
    model.setDraft("Summarize the current workspace");

    await expect(model.sendPrompt()).resolves.toBeUndefined();
    expect(model.getState().draft).toBe("");
    expect(model.getState().agent).toMatchObject({
      sessionId: "sdk-session",
      status: "error",
      lastError: "Missing SDK auth",
    });
  });

  test("cancels in-flight prompts through the transport and refreshes the snapshot", async () => {
    const api = {
      shell: {
        getSnapshot: vi.fn(async () => createShellSnapshotFixture()),
      },
      agent: {
        getSnapshot: vi
          .fn()
          .mockResolvedValueOnce(
            createAgentSnapshotFixture({
              sessionId: "sdk-session",
              status: "streaming",
              messages: [
                {
                  id: "assistant-1",
                  role: "assistant",
                  text: "Working...",
                  status: "streaming",
                  timestamp: 1,
                },
              ],
            }),
          )
          .mockResolvedValueOnce(
            createAgentSnapshotFixture({
              sessionId: "sdk-session",
              status: "ready",
              messages: [
                {
                  id: "assistant-1",
                  role: "assistant",
                  text: "Working...",
                  status: "streaming",
                  timestamp: 1,
                },
              ],
            }),
          ),
        prompt: vi.fn(async () => undefined),
        cancelPrompt: vi.fn(async () => undefined),
        subscribe: vi.fn(() => () => {}),
      },
      state: createStateApiFixture(),
    } as unknown as ShellModelApi;

    const model = createShellModel(api);
    await model.load();

    await model.cancelPrompt();

    expect(api.agent.cancelPrompt).toHaveBeenCalledTimes(1);
    expect(api.agent.getSnapshot).toHaveBeenCalledTimes(2);
    expect(model.getState().agent.status).toBe("ready");
  });

  test("preserves existing messages when prompt and snapshot refresh both fail", async () => {
    const partialMessage = {
      id: "assistant-1",
      role: "assistant" as const,
      text: "Partial answer from Pi SDK",
      status: "streaming" as const,
      timestamp: 1,
    };
    const prompt = vi.fn(async () => {
      throw new Error("Missing SDK auth");
    });

    const api = {
      shell: {
        getSnapshot: vi.fn(async () => createShellSnapshotFixture()),
      },
      agent: {
        getSnapshot: vi
          .fn()
          .mockResolvedValueOnce(
            createAgentSnapshotFixture({
              sessionId: "sdk-session",
              messages: [partialMessage],
            }),
          )
          .mockRejectedValueOnce(
            new Error("Agent host request getSnapshot timed out after 25ms"),
          ),
        prompt,
        cancelPrompt: vi.fn(async () => undefined),
        subscribe: vi.fn(() => () => {}),
      },
      state: createStateApiFixture(),
    } as unknown as ShellModelApi;

    const model = createShellModel(api);
    await model.load();
    model.setDraft("Summarize the current workspace");

    await expect(model.sendPrompt()).resolves.toBeUndefined();
    expect(model.getState().draft).toBe("");
    expect(model.getState().agent).toMatchObject({
      sessionId: "sdk-session",
      status: "error",
      lastError: "Agent host request getSnapshot timed out after 25ms",
    });
    expect(model.getState().agent.messages).toEqual([partialMessage]);
  });

  test("preserves newer live activity when a snapshot refresh returns stale data", async () => {
    let eventListener: ((event: PiDeskAgentEvent) => void) | undefined;
    const prompt = vi.fn(async () => {
      eventListener?.({ type: "agent_start" });
      eventListener?.({ type: "turn_start" });
      eventListener?.({
        type: "message_start",
        messageId: "assistant-1",
        role: "assistant",
        text: "",
        timestamp: 1,
      });
      eventListener?.({
        type: "tool_execution_start",
        toolCallId: "tool-1",
        toolName: "workspace.inspect",
        args: { prompt: "Summarize the current workspace" },
      });
      eventListener?.({
        type: "message_update",
        messageId: "assistant-1",
        role: "assistant",
        text: "Still streaming from Pi",
        delta: "Still streaming from Pi",
        timestamp: 2,
      });
    });

    const api = {
      shell: {
        getSnapshot: vi.fn(async () => createShellSnapshotFixture()),
      },
      agent: {
        getSnapshot: vi
          .fn()
          .mockResolvedValueOnce(createAgentSnapshotFixture())
          .mockResolvedValueOnce(createAgentSnapshotFixture()),
        prompt,
        cancelPrompt: vi.fn(async () => undefined),
        subscribe: vi.fn((listener) => {
          eventListener = listener;
          return () => {
            eventListener = undefined;
          };
        }),
      },
      state: createStateApiFixture(),
    } as unknown as ShellModelApi;

    const model = createShellModel(api);
    await model.load();
    model.setDraft("Summarize the current workspace");

    await model.sendPrompt();

    expect(model.getState().draft).toBe("");
    expect(model.getState().agent.messages).toContainEqual({
      id: "assistant-1",
      role: "assistant",
      text: "Still streaming from Pi",
      status: "streaming",
      timestamp: 2,
    });
    expect(model.getState().live.turns).toEqual([
      {
        id: "turn-1",
        status: "running",
        startedAt: expect.any(Number),
        endedAt: null,
        messageIds: ["assistant-1"],
        toolCallIds: ["tool-1"],
      },
    ]);
    expect(model.getState().live.toolsById["tool-1"]).toMatchObject({
      toolCallId: "tool-1",
      toolName: "workspace.inspect",
      status: "running",
    });
  });

  test("keeps final ready state when completion events arrive during snapshot refresh", async () => {
    let eventListener: ((event: PiDeskAgentEvent) => void) | undefined;
    let releaseSnapshot: (() => void) | undefined;
    const prompt = vi.fn(async () => {
      eventListener?.({ type: "agent_start" });
      eventListener?.({ type: "turn_start" });
      eventListener?.({
        type: "message_start",
        messageId: "assistant-1",
        role: "assistant",
        text: "",
        timestamp: 1,
      });
      eventListener?.({
        type: "message_update",
        messageId: "assistant-1",
        role: "assistant",
        text: "Still streaming from Pi",
        delta: "Still streaming from Pi",
        timestamp: 2,
      });
    });

    const api = {
      shell: {
        getSnapshot: vi.fn(async () => createShellSnapshotFixture()),
      },
      agent: {
        getSnapshot: vi
          .fn()
          .mockResolvedValueOnce(createAgentSnapshotFixture())
          .mockImplementationOnce(
            () =>
              new Promise<AgentSnapshot>((resolve) => {
                releaseSnapshot = () => {
                  resolve(
                    createAgentSnapshotFixture({
                      status: "streaming",
                      messages: [
                        {
                          id: "assistant-1",
                          role: "assistant",
                          text: "Still streaming from Pi",
                          status: "streaming",
                          timestamp: 2,
                        },
                      ],
                    }),
                  );
                };
              }),
          ),
        prompt,
        cancelPrompt: vi.fn(async () => undefined),
        subscribe: vi.fn((listener) => {
          eventListener = listener;
          return () => {
            eventListener = undefined;
          };
        }),
      },
      state: createStateApiFixture(),
    } as unknown as ShellModelApi;

    const model = createShellModel(api);
    await model.load();
    model.setDraft("Summarize the current workspace");

    const sendPromise = model.sendPrompt();
    await Promise.resolve();

    eventListener?.({
      type: "message_end",
      messageId: "assistant-1",
      role: "assistant",
      text: "PiDesk mock assistant received: Summarize the current workspace",
      timestamp: 3,
    });
    eventListener?.({ type: "turn_end" });
    eventListener?.({ type: "agent_end" });
    releaseSnapshot?.();

    await sendPromise;

    expect(model.getState().agent.status).toBe("ready");
    expect(model.getState().agent.messages).toContainEqual({
      id: "assistant-1",
      role: "assistant",
      text: "PiDesk mock assistant received: Summarize the current workspace",
      status: "complete",
      timestamp: 3,
    });
  });
});
