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
import { Message, MessageAvatar, MessageContent } from "../ui/message";
import { ScrollButton } from "../ui/scroll-button";
import { StepItem, Steps } from "../ui/steps";
import { SystemMessage } from "../ui/system-message";
import { TextShimmer } from "../ui/text-shimmer";
import { ThinkingBar } from "../ui/thinking-bar";
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

function getMessageFallback(message: AgentMessageSnapshot) {
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
    <div className="mx-auto flex max-w-[56rem] flex-col gap-6 px-8 py-10">
      <h2 className="text-[26px] leading-[1.15] text-white">{threadTitle}</h2>
      <p className="text-[14px] leading-7 text-[#969696]">
        Start typing below.
      </p>
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
      const shouldShow = distanceFromBottom > 80;

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
        "relative flex h-full min-h-0 flex-col bg-[#0d0d0d]",
        className,
      )}
    >
      <ChatContainerRoot
        className="min-h-0 flex-1"
        onScroll={handleTranscriptScroll}
      >
        <ChatContainerContent
          data-testid="chat-transcript"
          className="mx-auto flex w-full max-w-[68rem] flex-1 flex-col gap-6 px-8 py-8"
        >
          {messages.length === 0 ? (
            <ChatFirstEmptyState threadTitle={safeThreadTitle} />
          ) : (
            messages.map((message, index) => {
              const isSystem = message.role === "system";
              const isTool = message.role === "tool";
              const isAssistant = message.role === "assistant";

              return (
                <Message
                  key={message.id}
                  className={cn(
                    (isSystem || isTool) && "my-2 justify-center",
                    "stagger-item",
                  )}
                  style={{ animationDelay: `${(index % 8) * 40}ms` }}
                >
                  {!isSystem && !isTool ? (
                    <MessageAvatar
                      src=""
                      alt={getMessageLabel(message)}
                      fallback={getMessageFallback(message)}
                      className="mt-0.5"
                    />
                  ) : null}

                  <div
                    className={cn(
                      "min-w-0 flex-1",
                      (isSystem || isTool) && "flex-initial",
                    )}
                  >
                    {!isSystem && !isTool ? (
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        {getMessageLabel(message)}
                      </span>
                    ) : null}

                    {isSystem ? (
                      <SystemMessage
                        tone={message.status === "error" ? "error" : "info"}
                        title="System message"
                        className="mt-1"
                      >
                        {message.text}
                      </SystemMessage>
                    ) : isTool ? (
                      <div className="mt-1 max-w-2xl">
                        <Tool
                          toolPart={buildToolPart(message)}
                          defaultOpen={message.status !== "complete"}
                        />
                      </div>
                    ) : (
                      <div className="mt-1 space-y-3">
                        <MessageContent
                          markdown={message.role !== "user"}
                          className="max-w-none text-[14px] leading-7 text-foreground"
                        >
                          {message.text || " "}
                        </MessageContent>

                        {isAssistant ? (
                          <>
                            <FeedbackBar
                              value={feedbackByMessageId[message.id] ?? null}
                              onValueChange={(value) =>
                                handleFeedbackChange(message.id, value)
                              }
                              onCopy={() => handleCopyMessage(message.text)}
                            />
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                </Message>
              );
            })
          )}

          {isStreaming ? (
            <div className="space-y-3 border border-[#474747]/18 bg-[#101010] px-3 py-3">
              <ThinkingBar text="PiDesk is responding" />
              <div className="flex items-center gap-3">
                <Loader label="Streaming" />
                <TextShimmer className="text-[11px] uppercase tracking-[0.18em] text-white/65">
                  Reading, planning, and drafting
                </TextShimmer>
              </div>
              <Steps>
                <StepItem
                  title="Inspect current context"
                  detail="Reviewing the active thread and current context."
                  state="complete"
                />
                <StepItem
                  title="Reason through the task"
                  detail="Coordinating plan, tools, and response."
                  state="current"
                />
                <StepItem
                  title="Return grounded output"
                  detail="The reply lands with context and next steps."
                  state="pending"
                />
              </Steps>
            </div>
          ) : null}

          {lastError ? (
            <SystemMessage tone="error" title="Runtime error">
              {lastError}
            </SystemMessage>
          ) : null}

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      {showScrollButton ? (
        <div className="pointer-events-none absolute bottom-4 right-4 z-10">
          <ScrollButton
            className="pointer-events-auto"
            count={queuedMessageCount}
            onClick={handleJumpToLatest}
          >
            Jump to latest
          </ScrollButton>
        </div>
      ) : null}
    </div>
  );
}
