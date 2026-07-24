// @vitest-environment jsdom
// @vitest-environment jsdom
import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import { TooltipProvider } from "@pi-desktop/ui";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatThreadPanel } from "./chat-thread-panel";

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

vi.mock("@pi-desktop/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pi-desktop/ui")>();

  return {
    ...actual,
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
  };
});

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
  SystemMessage({
    title,
    children,
  }: React.PropsWithChildren<{ title?: string }>) {
    return (
      <div data-testid="system-message">
        {title ? <div>{title}</div> : null}
        {children}
      </div>
    );
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
    expect(emptyState).toHaveTextContent("Start a Thread with Pi");
    expect(emptyState).toHaveTextContent(/Ask about this Repository/);
    expect(screen.queryByTestId("chat-scroll-anchor")).not.toBeInTheDocument();
  });

  it("exposes retry from the error banner using classified guidance", () => {
    const onRetryLastUserMessage = vi.fn();

    render(
      <TooltipProvider>
        <ChatThreadPanel
          threadTitle="Signal"
          messages={[
            {
              id: "user-1",
              role: "user",
              text: "hello world",
              status: "complete",
              timestamp: 1,
            },
          ]}
          isStreaming={false}
          lastError="OAuth login failed: Unauthorized 401"
          onRetryLastUserMessage={onRetryLastUserMessage}
        />
      </TooltipProvider>,
    );

    expect(screen.getByTestId("chat-error-banner")).toHaveTextContent(
      "Sign-in required",
    );
    expect(screen.getByTestId("chat-error-banner")).not.toHaveTextContent(
      "Unauthorized 401",
    );

    screen.getByTestId("chat-error-retry").click();
    expect(onRetryLastUserMessage).toHaveBeenCalledWith("hello world");
  });

  it("exposes edit and resubmits the last user message", () => {
    const onResubmitUserMessage = vi.fn();

    render(
      <TooltipProvider>
        <ChatThreadPanel
          threadTitle="Signal"
          messages={[
            {
              id: "user-1",
              role: "user",
              text: "hello world",
              status: "complete",
              timestamp: 1,
            },
          ]}
          isStreaming={false}
          lastError={null}
          onResubmitUserMessage={onResubmitUserMessage}
        />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByTestId("message-edit"));
    expect(screen.getByTestId("message-inline-editor")).toBeInTheDocument();

    const textarea = screen
      .getByTestId("message-inline-editor")
      .querySelector("textarea");
    expect(textarea).not.toBeNull();
    if (!textarea) {
      throw new Error("expected inline editor textarea");
    }

    fireEvent.change(textarea, { target: { value: "edited prompt" } });
    fireEvent.click(screen.getByTestId("message-edit-submit"));
    expect(onResubmitUserMessage).toHaveBeenCalledWith(
      "user-1",
      "edited prompt",
    );
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
