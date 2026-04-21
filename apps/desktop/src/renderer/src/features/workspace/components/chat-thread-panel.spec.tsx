// @vitest-environment jsdom
import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatThreadPanel } from "./chat-thread-panel";

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

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

vi.mock("@/components/ui/feedback-bar", () => ({
  FeedbackBar() {
    return <div data-testid="feedback-bar" />;
  },
}));

vi.mock("@/components/ui/enhanced-message", () => ({
  EnhancedMessage({ id, content }: { id: string; content: string }) {
    return (
      <div className="w-full space-y-3 leading-6" data-message-id={id}>
        <div className="w-full">
          <div
            data-testid="message-content"
            className="max-w-none leading-6 [&_p]:my-2"
          >
            {content}
          </div>
        </div>
      </div>
    );
  },
}));

vi.mock("@/components/ui/scroll-button", () => ({
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

vi.mock("@/components/ui/system-message", () => ({
  SystemMessage({ children }: React.PropsWithChildren) {
    return <div data-testid="system-message">{children}</div>;
  },
}));

vi.mock("@/components/ui/tool", () => ({
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
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: originalScrollIntoView,
  });
});

describe("ChatThreadPanel", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("keeps the empty chat state as the only directly centered transcript child", () => {
    render(
      <ChatThreadPanel
        threadTitle="Signal"
        messages={[]}
        isStreaming={false}
        lastError={null}
      />,
    );

    const transcript = screen.getByTestId("chat-transcript");
    const emptyState = screen.getByTestId("chat-empty-state");

    expect(transcript).toHaveClass("min-h-full");
    expect(transcript.childElementCount).toBe(1);
    expect(transcript.firstElementChild).toBe(emptyState);
    expect(emptyState).toHaveClass(
      "flex",
      "min-h-full",
      "flex-1",
      "items-center",
      "justify-center",
    );
    expect(emptyState).toHaveTextContent("Start a conversation with Pi.");
    expect(screen.queryByTestId("chat-scroll-anchor")).not.toBeInTheDocument();
  });

  it("uses tighter transcript spacing for message rows", () => {
    render(
      <TooltipProvider>
        <ChatThreadPanel
          threadTitle="Signal"
          messages={[createAssistantMessage()]}
          isStreaming={false}
          lastError={null}
        />
      </TooltipProvider>,
    );

    const transcript = screen.getByTestId("chat-transcript");
    const messageContent = screen.getByTestId("message-content");
    const scrollAnchor = screen.getByTestId("chat-scroll-anchor");
    const messageRow = messageContent.closest(".group");
    const messageBody = messageContent.parentElement?.parentElement;

    expect(transcript).toHaveClass("pb-32");
    expect(transcript).toHaveClass("min-h-full");
    expect(transcript).not.toHaveClass("pb-48");
    expect(messageRow).toHaveClass("py-2");
    expect(messageRow).not.toHaveClass("py-5");
    expect(messageRow).not.toHaveClass("py-8");
    expect(messageBody).toHaveClass("leading-6");
    expect(messageBody).not.toHaveClass("leading-7");
    expect(messageContent).toHaveClass("leading-6");
    expect(messageContent).toHaveClass("[&_p]:my-2");
    expect(scrollAnchor).toBeInTheDocument();
  });

  it("scrolls to a targeted message when message navigation is requested", async () => {
    const onTargetMessageNavigated = vi.fn();

    render(
      <TooltipProvider>
        <ChatThreadPanel
          threadTitle="Signal"
          messages={[createAssistantMessage()]}
          isStreaming={false}
          lastError={null}
          targetMessageId="assistant-1"
          onTargetMessageNavigated={onTargetMessageNavigated}
        />
      </TooltipProvider>,
    );

    await waitFor(() => {
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: "center",
      });
    });

    expect(onTargetMessageNavigated).toHaveBeenCalledWith("assistant-1");
  });
});
