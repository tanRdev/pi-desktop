import type { AgentMessageSnapshot } from "@pidesk/shared";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@pidesk/ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { FeedbackBar, type FeedbackValue } from "../ui/feedback-bar";
import { Loader } from "../ui/loader";
import { MessageContent } from "../ui/message";
import { ScrollButton } from "../ui/scroll-button";
import { SystemMessage } from "../ui/system-message";
import { Tool } from "../ui/tool";

function getMessageLabel(message: AgentMessageSnapshot) {
  switch (message.role) {
    case "assistant":
      return "PiDesk";
    case "tool":
      return "Tool";
    case "system":
      return "System";
    default:
      return "You";
  }
}

function _getMessageFallback(message: AgentMessageSnapshot) {
  switch (message.role) {
    case "assistant":
      return "PI";
    case "tool":
      return "{}";
    case "system":
      return "!";
    default:
      return "U";
  }
}

function buildToolPart(message: AgentMessageSnapshot) {
  return {
    type: "workspace.tool",
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

function ChatFirstEmptyState({ threadTitle }: { threadTitle: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="text-center px-6">
        <h2 className="text-xl font-medium text-[#e7e7e7]">{threadTitle}</h2>
        <p className="mt-2 text-sm text-[#6a6a6a]">
          Start typing below to begin the conversation.
        </p>
      </div>
    </div>
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
  threadTitle,
  messages,
  isStreaming,
  lastError,
  className,
}: ChatThreadPanelProps) {
  const safeThreadTitle = threadTitle.trim() || "Untitled thread";
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
        "relative flex h-full min-h-0 flex-col bg-[#0a0a0a]",
        className,
      )}
    >
      <ChatContainerRoot
        className="min-h-0 flex-1"
        onScroll={handleTranscriptScroll}
      >
        <ChatContainerContent
          data-testid="chat-transcript"
          className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-6"
        >
          {messages.length === 0 ? (
            <ChatFirstEmptyState threadTitle={safeThreadTitle} />
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
                    "group flex gap-3",
                    isUser && "flex-row-reverse",
                    (isSystem || isTool) && "justify-center",
                    "stagger-item",
                  )}
                  style={{ animationDelay: `${(index % 8) * 30}ms` }}
                >
                  {/* Avatar - only for assistant */}
                  {isAssistant && (
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#27272a] bg-[#111111]">
                      <span className="text-[10px] font-semibold text-[#6a6a6a]">
                        PI
                      </span>
                    </div>
                  )}

                  {/* Message content */}
                  <div
                    className={cn(
                      "min-w-0 flex-1 space-y-1",
                      isUser && "max-w-[90%]",
                      isAssistant && "max-w-[90%]",
                      (isSystem || isTool) && "max-w-xl flex-initial",
                    )}
                  >
                    {/* Sender label */}
                    {!isSystem && !isTool && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[#6a6a6a]">
                          {getMessageLabel(message)}
                        </span>
                        {isAssistant && message.status === "streaming" && (
                          <span className="flex size-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                        )}
                      </div>
                    )}

                    {/* Message body */}
                    <div
                      className={cn(
                        "text-[15px] leading-relaxed",
                        isUser && "text-[#e7e7e7]",
                        isAssistant && "text-[#e7e7e7]",
                        (isSystem || isTool) && "text-[#8a8a8a]",
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
                          <MessageContent
                            markdown={message.role !== "user"}
                            className={cn(
                              "prose prose-invert max-w-none",
                              isUser &&
                                "rounded-xl border border-[#27272a] bg-[#111111] px-4 py-2.5",
                            )}
                          >
                            {message.text || " "}
                          </MessageContent>

                          {isAssistant && (
                            <div className="flex items-center gap-2 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
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
          {isStreaming && (
            <div className="flex items-center gap-3 rounded-lg border border-[#27272a] bg-[#111111] px-3 py-2">
              <Loader label="Responding" />
              <span className="text-xs text-[#6a6a6a]">Responding…</span>
            </div>
          )}

          {/* Error message */}
          {lastError && (
            <SystemMessage tone="error" title="Error">
              {lastError}
            </SystemMessage>
          )}

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      {/* Scroll button */}
      {showScrollButton && (
        <div className="pointer-events-none absolute bottom-4 right-6 z-10">
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
