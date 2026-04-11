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
          className={cn(
            "flex w-full flex-1 flex-col px-0 select-text",
            messages.length > 0 && "pb-48",
          )}
        >
          {messages.length === 0 ? (
            !isStreaming && !lastError ? (
              <div className="flex w-full flex-1 items-center justify-center px-6">
                <div className="max-w-md text-center font-mono text-[14px] uppercase tracking-[0.08em] text-white/25">
                  Start a conversation with Pi.
                </div>
              </div>
            ) : null
          ) : (
            messages.map((message, index) => {
              const isSystem = message.role === "system";
              const isTool = message.role === "tool";
              const isAssistant = message.role === "assistant";
              const isUser = message.role === "user";

              return (
                <div
                  key={message.id}
                  className={cn(
                    "group flex flex-col w-full py-8 px-0",
                    isUser && "items-end",
                    isAssistant && "items-start",
                    (isSystem || isTool) && "items-center",
                    "stagger-item",
                  )}
                  style={{ animationDelay: `${(index % 8) * 30}ms` }}
                >
                  {/* Message content wrapper for width control */}
                  <div
                    className={cn(
                      "min-w-0 flex flex-col gap-1 w-full max-w-3xl mx-auto px-6",
                      isUser && "items-end",
                      isAssistant && "items-start",
                      (isSystem || isTool) && "items-center",
                    )}
                  >
                    {/* Message body */}
                    <div
                      className={cn(
                        "text-sm leading-7 w-full",
                        isUser && "text-white/70 text-right",
                        isAssistant && "text-white/70",
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
                        <div className="w-full">
                          <Tool
                            toolPart={buildToolPart(message)}
                            defaultOpen={message.status !== "complete"}
                          />
                        </div>
                      ) : (
                        <div className="space-y-2 w-full">
                          {isUser ? (
                            <div className="prose prose-invert max-w-none text-sm leading-7 text-white/70">
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
                                value={feedbackByMessageId[message.id] ?? null}
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
            })
          )}

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
