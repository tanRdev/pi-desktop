// @vitest-environment jsdom
import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildChatTurns } from "./chat/chat-thread-turns";
import { ChatThreadVirtualTurnList } from "./chat-thread-virtual-turn-list";

function createMessages(count: number): AgentMessageSnapshot[] {
  const messages: AgentMessageSnapshot[] = [];
  for (let index = 0; index < count; index += 1) {
    messages.push({
      id: `user-${index}`,
      role: "user",
      text: `Question ${index}`,
      status: "complete",
      timestamp: index * 2,
    });
    messages.push({
      id: `assistant-${index}`,
      role: "assistant",
      text: `Answer ${index}`,
      status: "complete",
      timestamp: index * 2 + 1,
    });
  }
  return messages;
}

function renderList(
  turnCount: number,
  overrides: Partial<Parameters<typeof ChatThreadVirtualTurnList>[0]> = {},
) {
  const turns = buildChatTurns(createMessages(turnCount));
  return render(
    <ChatThreadVirtualTurnList
      turns={turns}
      isStreaming={false}
      renderTurn={(turn) => (
        <div data-testid={`turn-content-${turn.id}`}>{turn.id}</div>
      )}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("ChatThreadVirtualTurnList", () => {
  it("mounts a bounded number of rows for a 2000-turn fixture", () => {
    renderList(2000);

    const rows = screen.getAllByTestId("chat-turn-row");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(30);
    // The latest turns are mounted on first paint; early history is not.
    expect(screen.getByTestId("turn-content-user-1999")).toBeInTheDocument();
    expect(screen.queryByTestId("turn-content-user-0")).not.toBeInTheDocument();
    // Skipped history is represented by spacers, keeping the total
    // scroll height (and therefore the scroll position) meaningful.
    expect(screen.getAllByTestId("virtual-turn-spacer").length).toBeGreaterThan(
      0,
    );
  });

  it("re-renders only the trailing window when a streaming turn appends", () => {
    const messages = createMessages(2000);
    const turns = buildChatTurns(messages);
    const { rerender } = render(
      <ChatThreadVirtualTurnList
        turns={turns}
        isStreaming={true}
        renderTurn={(turn) => <div>{turn.id}</div>}
      />,
    );
    const before = screen
      .getAllByTestId("chat-turn-row")
      .map((row) => row.dataset.turnId);

    const nextTurns = buildChatTurns([
      ...messages,
      {
        id: "assistant-1999",
        role: "assistant",
        text: "Answer 1999 (streaming more)",
        status: "streaming",
        timestamp: 4000,
      },
    ]);
    rerender(
      <ChatThreadVirtualTurnList
        turns={nextTurns}
        isStreaming={true}
        renderTurn={(turn) => <div>{turn.id}</div>}
      />,
    );

    const after = screen
      .getAllByTestId("chat-turn-row")
      .map((row) => row.dataset.turnId);
    expect(after).toEqual(before);
    expect(after[after.length - 1]).toBe("user-1999");
  });

  it("force-mounts the turn containing a targeted (search) message", () => {
    renderList(2000, { targetMessageId: "assistant-123" });

    // Turn 123 is far outside the trailing window but must be mounted so
    // the panel can scroll it into view.
    expect(screen.getByTestId("turn-content-user-123")).toBeInTheDocument();
    expect(screen.getByTestId("turn-content-user-1999")).toBeInTheDocument();
    expect(screen.getAllByTestId("chat-turn-row").length).toBeLessThanOrEqual(
      31,
    );
  });

  it("renders every turn when the history is short", () => {
    renderList(5);
    expect(screen.getAllByTestId("chat-turn-row")).toHaveLength(5);
    expect(screen.queryByTestId("virtual-turn-spacer")).not.toBeInTheDocument();
  });

  it("renders nothing for an empty history", () => {
    render(
      <ChatThreadVirtualTurnList
        turns={[]}
        isStreaming={false}
        renderTurn={(turn) => <div>{turn.id}</div>}
      />,
    );
    expect(
      screen.queryByTestId("chat-virtual-turn-list"),
    ).not.toBeInTheDocument();
  });
});
