import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import type * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatThreadPanel } from "./chat-thread-panel";

vi.mock("@pi-desktop/ui", () => ({
  ChatContainerRoot({
    children,
    className,
    onScroll,
  }: React.PropsWithChildren<{
    className?: string;
    onScroll?: React.UIEventHandler<HTMLDivElement>;
  }>) {
    return (
      <div
        data-testid="chat-container-root"
        className={className}
        onScroll={onScroll}
      >
        {children}
      </div>
    );
  },
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
}));

vi.mock("../ui/feedback-bar", () => ({
  FeedbackBar() {
    return <div data-testid="feedback-bar" />;
  },
}));

vi.mock("../ui/message", () => ({
  MessageContent({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) {
    return (
      <div data-testid="message-content" className={className}>
        {children}
      </div>
    );
  },
}));

vi.mock("../ui/scroll-button", () => ({
  ScrollButton({
    children,
    className,
    onClick,
  }: React.PropsWithChildren<{
    className?: string;
    onClick?: () => void;
  }>) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {children}
      </button>
    );
  },
}));

vi.mock("../ui/system-message", () => ({
  SystemMessage({ children }: React.PropsWithChildren) {
    return <div data-testid="system-message">{children}</div>;
  },
}));

vi.mock("../ui/tool", () => ({
  Tool() {
    return <div data-testid="tool-message" />;
  },
}));

function createAssistantMessage(
  overrides: Partial<AgentMessageSnapshot> = {},
): AgentMessageSnapshot {
  return {
    id: "assistant-1",
    role: "assistant",
    text: "Hello from Pi",
    status: "complete",
    timestamp: 1,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("ChatThreadPanel", () => {
  it("uses tighter transcript spacing for message rows", () => {
    render(
      <ChatThreadPanel
        threadTitle="Signal"
        messages={[createAssistantMessage()]}
        isStreaming={false}
        lastError={null}
      />,
    );

    const transcript = screen.getByTestId("chat-transcript");
    const messageContent = screen.getByTestId("message-content");
    const messageRow = messageContent.closest(".group");
    const messageBody = messageContent.parentElement?.parentElement;

    expect(transcript).toHaveClass("pb-32");
    expect(transcript).not.toHaveClass("pb-48");
    expect(messageRow).toHaveClass("py-5");
    expect(messageRow).not.toHaveClass("py-8");
    expect(messageBody).toHaveClass("leading-6");
    expect(messageBody).not.toHaveClass("leading-7");
    expect(messageContent).toHaveClass("leading-6");
    expect(messageContent).toHaveClass("[&_p]:my-2");
  });
});
