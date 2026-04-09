import type { AgentMessageSnapshot } from "@pidesk/shared";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@pidesk/ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { FeedbackBar, type FeedbackValue } from "../ui/feedback-bar";
import { MessageContent } from "../ui/message";
import { ScrollButton } from "../ui/scroll-button";
import { SystemMessage } from "../ui/system-message";
import { ThinkingBar } from "../ui/thinking-bar";
import { Tool } from "../ui/tool";

// ---------------------------------------------------------------------------
// Message helpers
// ---------------------------------------------------------------------------

function getMessageLabel(message: AgentMessageSnapshot) {
  switch (message.role) {
    case "assistant":
      return "Pi";
    case "tool":
      return "Tool";
    case "system":
      return "System";
    default:
      return "You";
  }
}

function buildToolPart(message: AgentMessageSnapshot) {
  const toolNameMatch = /^tool:([^:]+):/.exec(message.id);

  return {
    type: toolNameMatch?.[1] ?? "workspace.tool",
    state:
      message.status === "error"
        ? "output-error"
        : message.status === "streaming"
          ? "input-streaming"
          : "output-available",
    output: { transcript: message.text || "No tool output yet." },
    errorText: message.status === "error" ? message.text : undefined,
  } as const;
}

// Slash command highlighter component
interface SlashCommandHighlighterProps {
  text: string;
}

function SlashCommandHighlighter({ text }: SlashCommandHighlighterProps) {
  const parts = text.split(/(\/[a-zA-Z0-9_-]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("/")) {
          return (
            <span key={i} className="text-amber-400/90 font-mono">
              {part}
            </span>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

export interface ChatThreadPanelProps {
  threadTitle: string;
  messages: AgentMessageSnapshot[];
  isStreaming: boolean;
  lastError: string | null;
  className?: string;
}

export function ChatThreadPanel({
  threadTitle: _threadTitle,
  messages,
  isStreaming,
  lastError,
  className,
}: ChatThreadPanelProps) {
  const [feedbackByMessageId, setFeedbackByMessageId] = React.useState<
    Record<string, FeedbackValue>
  >({});
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const [queuedMessageCount, setQueuedMessageCount] = React.useState(0);
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = React.useRef(messages.length);

  React.useEffect(() => {
    if (showScrollButton && messages.length > previousMessageCountRef.current) {
      setQueuedMessageCount((currentCount) => currentCount + 1);
    }
    previousMessageCountRef.current = messages.length;
  }, [messages.length, showScrollButton]);

  const handleTranscriptScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const viewport = event.currentTarget;
      scrollViewportRef.current = viewport;

      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const shouldShow = distanceFromBottom > 100;

      setShowScrollButton(shouldShow);
      if (!shouldShow) {
        setQueuedMessageCount(0);
      }
    },
    [],
  );

  const handleJumpToLatest = React.useCallback(() => {
    scrollViewportRef.current?.scrollTo({
      top: scrollViewportRef.current.scrollHeight,
      behavior: "smooth",
    });
    setShowScrollButton(false);
    setQueuedMessageCount(0);
  }, []);

  const handleFeedbackChange = React.useCallback(
    (messageId: string, value: FeedbackValue) => {
      setFeedbackByMessageId((currentState) => ({
        ...currentState,
        [messageId]: value,
      }));
    },
    [],
  );

  const handleCopyMessage = React.useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col bg-[var(--shell-main-bg)] select-none",
        className,
      )}
    >
      {/* Messages area */}
      <ChatContainerRoot
        className="min-h-0 flex-1"
        onScroll={handleTranscriptScroll}
      >
        <ChatContainerContent
          data-testid="chat-transcript"
          className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 pb-48 pt-6 select-text"
        >
          {messages.length === 0
            ? // Cursor Glass: completely empty, no placeholder text
              null
            : messages.map((message, index) => {
                const isSystem = message.role === "system";
                const isTool = message.role === "tool";
                const isAssistant = message.role === "assistant";
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "group flex items-start",
                      isUser && "justify-end",
                      (isSystem || isTool) && "justify-center",
                      "stagger-item",
                    )}
                    style={{ animationDelay: `${(index % 8) * 30}ms` }}
                  >
                    {/* Message content */}
                    <div
                      className={cn(
                        "min-w-0 space-y-1",
                        isUser && "ml-auto w-fit max-w-[42rem]",
                        isAssistant && "w-fit max-w-[42rem]",
                        (isSystem || isTool) && "max-w-xl flex-initial",
                      )}
                    >
                      {/* Sender label */}
                      {!isSystem && !isTool && (
                        <div
                          className={cn(
                            "flex items-center gap-2",
                            isUser && "justify-end",
                          )}
                        >
                          <span className="text-[11px] font-medium text-white/30">
                            {getMessageLabel(message)}
                          </span>
                          {isAssistant && message.status === "streaming" && (
                            <span className="flex size-1.5 rounded-full bg-amber-400/60 animate-pulse" />
                          )}
                        </div>
                      )}

                      {/* Message body */}
                      <div
                        className={cn(
                          "text-[14px] leading-relaxed",
                          isUser && "text-white/90",
                          isAssistant && "text-white/90",
                          (isSystem || isTool) && "text-white/40",
                        )}
                      >
                        {isSystem ? (
                          <SystemMessage
                            tone={message.status === "error" ? "error" : "info"}
                            title="System"
                          >
                            {message.text}
                          </SystemMessage>
                        ) : isTool ? (
                          <div className="max-w-xl">
                            <Tool
                              toolPart={buildToolPart(message)}
                              defaultOpen={message.status !== "complete"}
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {message.role === "user" ? (
                              <div className="prose prose-invert max-w-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[14px] leading-relaxed text-white/90">
                                <SlashCommandHighlighter
                                  text={message.text || " "}
                                />
                              </div>
                            ) : (
                              <MessageContent
                                markdown={true}
                                className="prose prose-invert max-w-none"
                              >
                                {message.text || " "}
                              </MessageContent>
                            )}

                            {isAssistant && (
                              <div className="flex items-center gap-2 pt-1 opacity-0 transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out)] group-hover:opacity-100">
                                <FeedbackBar
                                  value={
                                    feedbackByMessageId[message.id] ?? null
                                  }
                                  onValueChange={(value) =>
                                    handleFeedbackChange(message.id, value)
                                  }
                                  onCopy={() => handleCopyMessage(message.text)}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

          {/* Streaming indicator */}
          {isStreaming && <ThinkingBar text="Pi is responding" />}

          {/* Error message */}
          {lastError && (
            <SystemMessage tone="error" title="Error">
              {lastError}
            </SystemMessage>
          )}

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      {/* Scroll button — above input */}
      {showScrollButton && (
        <div className="pointer-events-none absolute bottom-32 right-6 z-10">
          <ScrollButton
            className="pointer-events-auto"
            count={queuedMessageCount}
            onClick={handleJumpToLatest}
          >
            Jump to latest
          </ScrollButton>
        </div>
      )}
    </div>
  );
}
