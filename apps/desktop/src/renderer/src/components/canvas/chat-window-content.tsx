import type { AgentMessageSnapshot } from "@pidesk/shared";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@pidesk/ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from "../ui/chain-of-thought";
import { FeedbackBar, type FeedbackValue } from "../ui/feedback-bar";
import { Image } from "../ui/image";
import { Loader } from "../ui/loader";
import { Message, MessageAvatar, MessageContent } from "../ui/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "../ui/reasoning";
import { ScrollButton } from "../ui/scroll-button";
import { Source, SourceList } from "../ui/source";
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

const EMPTY_CHAT_PREVIEW =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#0f0f0f"/><circle cx="160" cy="136" r="72" fill="#1e1e1e"/><circle cx="640" cy="346" r="92" fill="#181818"/><rect x="120" y="92" width="248" height="168" fill="#111" stroke="#3f3f3f"/><rect x="420" y="164" width="260" height="176" fill="#141414" stroke="#4c4c4c"/><rect x="168" y="296" width="420" height="30" fill="#161616" stroke="#393939"/><rect x="168" y="344" width="304" height="20" fill="#1d1d1d"/><rect x="168" y="378" width="212" height="20" fill="#1d1d1d"/></svg>`,
  );

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

function ChatEmptyState({
  safeThreadTitle,
  isActiveThread,
}: {
  safeThreadTitle: string;
  isActiveThread: boolean;
}) {
  return (
    <div className="space-y-4">
      <SystemMessage
        tone={isActiveThread ? "success" : "info"}
        title="Prompt Kit Surface"
      >
        {isActiveThread
          ? `Chat is centered on ${safeThreadTitle} and ready for staged uploads, sources, tools, and long-form reasoning.`
          : `Focus ${safeThreadTitle} to connect the floating composer and start a full Prompt Kit-style session.`}
      </SystemMessage>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4 border border-[#474747]/18 bg-[#0f0f0f]/94 p-4">
          <div className="space-y-2">
            <TextShimmer className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/72">
              Canvas-ready chat orchestration
            </TextShimmer>
            <p className="text-[13px] leading-6 text-[#a3a3a3]">
              This thread opens as a fully composed Prompt Kit surface:
              suggestions in the dock, staged uploads beside the prompt, sources
              in-line, and structured reasoning when answers need to stretch
              across the workspace.
            </p>
          </div>

          <Reasoning
            className="border border-[#474747]/18 bg-[#111111] px-3 py-3"
            open
          >
            <ReasoningTrigger className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/78">
              Why the blank state starts in chat
            </ReasoningTrigger>
            <ReasoningContent
              className="pt-2"
              contentClassName="mt-0 border border-[#474747]/16 bg-[#0c0c0c] p-3 text-[12px] leading-5 text-[#9a9a9a] prose-none"
            >
              Conversation is now the first-class entry point. Notes are still
              one click away, but the canvas begins in the mode where staged
              uploads, tools, and source-grounded replies can work together.
            </ReasoningContent>
          </Reasoning>

          <ChainOfThought className="space-y-1">
            <ChainOfThoughtStep defaultOpen>
              <ChainOfThoughtTrigger className="font-mono text-[10px] uppercase tracking-[0.18em]">
                Prime the workspace
              </ChainOfThoughtTrigger>
              <ChainOfThoughtContent>
                <ChainOfThoughtItem>
                  Bring the active thread, its files, and the selected model
                  into the same visual frame.
                </ChainOfThoughtItem>
              </ChainOfThoughtContent>
            </ChainOfThoughtStep>
            <ChainOfThoughtStep defaultOpen>
              <ChainOfThoughtTrigger className="font-mono text-[10px] uppercase tracking-[0.18em]">
                Route real work
              </ChainOfThoughtTrigger>
              <ChainOfThoughtContent>
                <ChainOfThoughtItem>
                  Use uploads, tool traces, feedback, and sources so the
                  transcript feels operational instead of decorative.
                </ChainOfThoughtItem>
              </ChainOfThoughtContent>
            </ChainOfThoughtStep>
          </ChainOfThought>

          <Steps>
            <StepItem
              title="Attach context"
              detail="Drop code, screenshots, or specs into the dock before sending the first prompt."
              state="complete"
            />
            <StepItem
              title="Ask for the next move"
              detail="Use the suggestion chips or type the exact task you want executed."
              state="current"
            />
            <StepItem
              title="Review grounded output"
              detail="Look for sources, tool traces, and feedback actions under assistant responses."
              state="pending"
            />
          </Steps>
        </div>

        <div className="space-y-4">
          <Image
            src={EMPTY_CHAT_PREVIEW}
            alt="PiDesk canvas preview"
            aspect="landscape"
          />
          <SourceList>
            <Source label="Thread" detail={safeThreadTitle} />
            <Source label="Surface" detail="Centered chat window" />
            <Source label="Composer" detail="Prompt suggestions + uploads" />
          </SourceList>
        </div>
      </div>
    </div>
  );
}

export interface ChatWindowContentProps {
  threadTitle: string;
  isActiveThread: boolean;
  messages: AgentMessageSnapshot[];
  isStreaming: boolean;
  lastError: string | null;
  className?: string;
}

export function ChatWindowContent({
  threadTitle,
  isActiveThread,
  messages,
  isStreaming,
  lastError,
  className,
}: ChatWindowContentProps) {
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
        "relative flex h-full min-h-0 flex-col bg-surface-1",
        className,
      )}
    >
      {!isActiveThread ? (
        <SystemMessage tone="info" title="Composer link">
          Focus this chat window to link the composer to {safeThreadTitle}.
        </SystemMessage>
      ) : null}

      <ChatContainerRoot
        className="min-h-0 flex-1"
        onScroll={handleTranscriptScroll}
      >
        <ChatContainerContent
          data-testid="chat-transcript"
          className="flex flex-1 flex-col gap-4 px-4 py-4"
        >
          {messages.length === 0 ? (
            <ChatEmptyState
              safeThreadTitle={safeThreadTitle}
              isActiveThread={isActiveThread}
            />
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
                          className="max-w-none text-[13px] leading-6 text-foreground"
                        >
                          {message.text || " "}
                        </MessageContent>

                        {isAssistant ? (
                          <>
                            <SourceList>
                              <Source label="Thread" detail={safeThreadTitle} />
                              <Source
                                label="Role"
                                detail="Assistant response"
                              />
                              <Source
                                label="Transcript"
                                detail={`${message.status} state`}
                              />
                            </SourceList>

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
                  Tool-aware response in progress
                </TextShimmer>
              </div>
              <Steps>
                <StepItem
                  title="Read thread state"
                  detail="Collecting active thread, files, and prompt context."
                  state="complete"
                />
                <StepItem
                  title="Plan the answer"
                  detail="Reasoning over the latest canvas state and tool output."
                  state="current"
                />
                <StepItem
                  title="Return grounded response"
                  detail="Sources and feedback controls appear as soon as the reply lands."
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
