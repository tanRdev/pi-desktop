// @vitest-environment jsdom

import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

const turnRendererMock = vi.fn<(props: unknown) => React.JSX.Element>(() => (
  <div data-testid="chat-thread-turn-renderer-seam" />
));

vi.mock("@pi-desktop/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pi-desktop/ui")>();

  return {
    ...actual,
    ChatContainerContent({
      children,
      className,
      ...props
    }: React.PropsWithChildren<{
      className?: string;
    }>) {
      return (
        <div
          data-testid="chat-container-content"
          className={className}
          {...props}
        >
          {children}
        </div>
      );
    },
    ChatContainerScrollAnchor() {
      return <div data-testid="chat-scroll-anchor" />;
    },
  };
});

vi.mock("./chat-thread-transcript-turn", async () => ({
  ChatThreadTranscriptTurn: (props: unknown) => {
    turnRendererMock(props);
    return <div data-testid="chat-thread-turn-renderer-seam" />;
  },
}));

vi.mock("boneyard-js/react", () => ({
  Skeleton({ children }: React.PropsWithChildren) {
    return <>{children}</>;
  },
}));

vi.mock("@/components/ui/enhanced-message", () => ({
  EnhancedMessage({ content }: { content: string }) {
    return <div>{content}</div>;
  },
}));

vi.mock("@/components/ui/system-message", () => ({
  SystemMessage({ children }: React.PropsWithChildren) {
    return <div>{children}</div>;
  },
}));

vi.mock("@/components/ui/tool", () => ({
  Tool() {
    return <div data-testid="tool-message" />;
  },
}));

vi.mock("./chat/file-change-summary", () => ({
  FileChangeSummary() {
    return <div data-testid="file-change-summary" />;
  },
}));

vi.mock("./chat/message-actions", () => ({
  InlineMessageEditor() {
    return <div data-testid="inline-message-editor" />;
  },
  MessageActions() {
    return <div data-testid="message-actions" />;
  },
}));

vi.mock("./chat/message-timestamp", () => ({
  MessageTimestamp() {
    return <div data-testid="message-timestamp" />;
  },
}));

vi.mock("./chat/response-divider", () => ({
  ResponseDivider() {
    return <div data-testid="response-divider" />;
  },
}));

vi.mock("./chat/token-count", () => ({
  TokenCount() {
    return <div data-testid="token-count" />;
  },
}));

import {
  ChatThreadTranscript,
  type ChatThreadTranscriptProps,
} from "./chat-thread-transcript";

function createMessage(
  overrides: Partial<AgentMessageSnapshot>,
): AgentMessageSnapshot {
  return {
    id: "message-1",
    role: "assistant",
    text: "Hello from Pi",
    status: "complete",
    timestamp: 100,
    ...overrides,
  };
}

function createProps(
  overrides: Partial<ChatThreadTranscriptProps> = {},
): ChatThreadTranscriptProps {
  const assistantMessage = createMessage({
    id: "assistant-1",
    role: "assistant",
  });

  return {
    messages: [assistantMessage],
    turns: [
      {
        id: "turn-1",
        userMessage: null,
        messages: [assistantMessage],
        isStreaming: false,
        lastAssistantTimestamp: assistantMessage.timestamp,
      },
    ],
    isLoading: false,
    isStreaming: false,
    lastError: null,
    onCopyMessage: vi.fn(),
    ...overrides,
  };
}

describe("ChatThreadTranscript turn rendering seam", () => {
  it("delegates each turn transcript render to the adjacent turn renderer module", () => {
    const props = createProps();

    render(<ChatThreadTranscript {...props} />);

    expect(
      screen.getByTestId("chat-thread-turn-renderer-seam"),
    ).toBeInTheDocument();
    expect(turnRendererMock).toHaveBeenCalledOnce();
  });
});
