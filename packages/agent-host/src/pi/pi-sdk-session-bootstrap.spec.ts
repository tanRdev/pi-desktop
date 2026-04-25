import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import type {
  AgentMessageSnapshot,
  AgentSnapshot,
  PiDesktopAgentEvent,
} from "@pi-desktop/shared";
import { describe, expect, it, vi } from "vitest";

import { createBootstrappedSession } from "./pi-sdk-session-bootstrap.js";

type SessionMessage = {
  role: string;
  timestamp: number;
  content: Array<{ type: string; text: string }>;
};

describe("createBootstrappedSession", () => {
  it("creates a session, subscribes normalized events, and refreshes the ready snapshot", async () => {
    const messages: SessionMessage[] = [
      {
        role: "assistant",
        timestamp: 123,
        content: [{ type: "text", text: "Ready" }],
      },
    ];
    const session = {
      sessionId: "session-1",
      messages,
      subscribe: vi.fn((listener: (event: AgentSessionEvent) => void) => {
        listener({ type: "agent_start" });
        return () => undefined;
      }),
    };
    const createSession = vi.fn(
      async (_options: { cwd: string; agentDir?: string }) => ({ session }),
    );
    const applyNormalizedEvent = vi.fn(
      (snapshot: AgentSnapshot, event: PiDesktopAgentEvent) => ({
        ...snapshot,
        status: event.type === "agent_start" ? "streaming" : snapshot.status,
      }),
    );
    const emit = vi.fn();
    const refreshReadySnapshot = vi.fn((nextSession: typeof session) => ({
      sessionId: nextSession.sessionId,
      status: "ready" as const,
      messages: [
        {
          id: "assistant-123",
          role: "assistant",
          text: "Ready",
          status: "complete",
          timestamp: 123,
        } satisfies AgentMessageSnapshot,
      ],
      lastError: null,
    }));

    const result = await createBootstrappedSession<typeof session>({
      createSession,
      createSessionOptions: {
        cwd: "/repo",
        agentDir: "/repo/.pi",
      },
      snapshot: {
        sessionId: "",
        status: "starting",
        messages: [],
        lastError: null,
      },
      applyNormalizedEvent,
      emit,
      refreshReadySnapshot,
    });

    expect(createSession).toHaveBeenCalledWith({
      cwd: "/repo",
      agentDir: "/repo/.pi",
    });
    expect(session.subscribe).toHaveBeenCalledOnce();
    expect(applyNormalizedEvent).toHaveBeenCalledWith(
      {
        sessionId: "",
        status: "starting",
        messages: [],
        lastError: null,
      },
      { type: "agent_start" },
    );
    expect(emit).toHaveBeenCalledWith({ type: "agent_start" });
    expect(refreshReadySnapshot).toHaveBeenCalledWith(session);
    expect(result).toEqual({
      session,
      snapshot: {
        sessionId: "session-1",
        status: "ready",
        messages: [
          {
            id: "assistant-123",
            role: "assistant",
            text: "Ready",
            status: "complete",
            timestamp: 123,
          },
        ],
        lastError: null,
      },
      unsubscribe: expect.any(Function),
    });
  });
});
