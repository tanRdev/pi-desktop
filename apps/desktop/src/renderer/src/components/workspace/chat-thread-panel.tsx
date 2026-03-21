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
import { Loader } from "../ui/loader";
import { Message, MessageAvatar, MessageContent } from "../ui/message";
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
    <div className="space-y-4">
      <SystemMessage tone="success" title="Chat-first workspace">
        {threadTitle} is ready. Ask for a goal, and PiDesk will plan the work,
        stream reasoning, and keep the latest context surfaces beside the chat.
      </SystemMessage>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-4 border border-[#474747]/18 bg-[#0f0f0f]/94 p-4">
          <div className="space-y-2">
            <TextShimmer className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/72">
              Autonomous execution loop
            </TextShimmer>
            <p className="text-[13px] leading-6 text-[#a3a3a3]">
              Start from a high-level goal. PiDesk will explore the repo, form a
              plan, stream tool activity, and keep the most relevant files,
              notes, or git context in the side panel.
            </p>
          </div>

          <ChainOfThought className="space-y-1">
            <ChainOfThoughtStep defaultOpen>
              <ChainOfThoughtTrigger className="font-mono text-[10px] uppercase tracking-[0.18em]">
                Explore first
              </ChainOfThoughtTrigger>
              <ChainOfThoughtContent>
                <ChainOfThoughtItem>
                  Map the codebase before editing so backend, frontend, and data
                  model changes stay aligned.
                </ChainOfThoughtItem>
              </ChainOfThoughtContent>
            </ChainOfThoughtStep>
            <ChainOfThoughtStep defaultOpen>
              <ChainOfThoughtTrigger className="font-mono text-[10px] uppercase tracking-[0.18em]">
                Work in public
              </ChainOfThoughtTrigger>
              <ChainOfThoughtContent>
                <ChainOfThoughtItem>
                  Live reasoning, tool calls, and progress history appear in the
                  context pane as the agent works.
                </ChainOfThoughtItem>
              </ChainOfThoughtContent>
            </ChainOfThoughtStep>
          </ChainOfThought>

          <Steps>
            <StepItem
              title="Describe the outcome"
              detail="Ask for the feature, bugfix, or investigation in natural language."
              state="current"
            />
            <StepItem
              title="Review the plan"
              detail="Watch the activity pane for running, done, or blocked work."
              state="pending"
            />
            <StepItem
              title="Inspect supporting context"
              detail="Use files, notes, git, and terminal surfaces without leaving the thread."
              state="pending"
            />
          </Steps>
        </div>

        <div className="space-y-4 border border-[#474747]/18 bg-[#101010] p-4">
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#6f6f6f]">
              Recommended starters
            </p>
            <SourceList>
              <Source label="Map" detail="Summarize the architecture first" />
              <Source label="Plan" detail="List the implementation steps" />
              <Source
                label="Fix"
                detail="Write the failing test, then patch it"
              />
            </SourceList>
          </div>
          <div className="border border-[#474747]/18 bg-[#0c0c0c] px-3 py-3 text-[12px] leading-5 text-[#909090]">
            The right panel stays synced to the conversation so you can inspect
            context without the old floating canvas.
          </div>
        </div>
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
          className="flex flex-1 flex-col gap-4 px-5 py-5"
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
                  Planning, reading, and drafting in public
                </TextShimmer>
              </div>
              <Steps>
                <StepItem
                  title="Inspect current context"
                  detail="Reviewing the active thread, files, and runtime state."
                  state="complete"
                />
                <StepItem
                  title="Reason through the task"
                  detail="Coordinating plan, tools, and output before the reply lands."
                  state="current"
                />
                <StepItem
                  title="Return grounded output"
                  detail="Sources, tool traces, and follow-up actions arrive with the answer."
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
