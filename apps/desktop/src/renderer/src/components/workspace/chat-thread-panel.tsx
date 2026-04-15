import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@pi-desktop/ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollButton } from "../ui/scroll-button";
import { SystemMessage } from "../ui/system-message";
import { Tool } from "../ui/tool";
import {
  ActivityIndicator,
  StreamingIndicator,
} from "../ui/activity-indicator";
import { EnhancedMessage } from "../ui/enhanced-message";
import type { FeedbackValue } from "../ui/feedback-bar";
import type { ActivityIndicatorProps } from "../ui/activity-indicator";

type ChatMessageRowProps = {
  message: AgentMessageSnapshot;
  index: number;
  feedback: FeedbackValue | null;
  onFeedbackChange: (messageId: string, value: FeedbackValue) => void;
  onCopyMessage: (text: string) => void;
};

// Parse tool message ID to extract tool name
type ToolState = "input-streaming" | "output-available" | "output-error";

function getToolState(message: AgentMessageSnapshot): ToolState {
  switch (message.status) {
    case "error":
      return "output-error";
    case "streaming":
      return "input-streaming";
    default:
      return "output-available";
  }
}

function buildToolPart(message: AgentMessageSnapshot) {
  const toolNameMatch = /^tool:([^:]+):/.exec(message.id);

  return {
    type: toolNameMatch?.[1] ?? "workspace.tool",
    state: getToolState(message),
    output: { transcript: message.text || "No tool output yet." },
    errorText: message.status === "error" ? message.text : undefined,
  } as const;
}

// Parse activities from message ID patterns
function extractActivitiesFromMessage(message: AgentMessageSnapshot): Array<{
  id: string;
  type: ActivityIndicatorProps["type"];
  label: string;
  status: "pending" | "running" | "complete" | "error";
}> {
  const activities: Array<{
    id: string;
    type: ActivityIndicatorProps["type"];
    label: string;
    status: "pending" | "running" | "complete" | "error";
  }> = [];

  // Tool activity
  if (message.role === "tool") {
    const toolNameMatch = /^tool:([^:]+):/.exec(message.id);
    const toolName = toolNameMatch?.[1] ?? "tool";
    activities.push({
      id: `tool-${message.id}`,
      type: "tool",
      label: toolName,
      status:
        message.status === "streaming"
          ? "running"
          : message.status === "error"
            ? "error"
            : "complete",
    });
  }

  // Search patterns
  if (
    message.text?.includes("search") ||
    message.text?.includes("Search") ||
    message.id.includes("search")
  ) {
    activities.push({
      id: `search-${message.id}`,
      type: "search",
      label: "Search",
      status: message.status === "streaming" ? "running" : "complete",
    });
  }

  // Web browsing
  if (
    message.text?.includes("http") ||
    message.text?.includes("url") ||
    message.text?.includes("fetch")
  ) {
    activities.push({
      id: `web-${message.id}`,
      type: "web",
      label: "Web",
      status: message.status === "streaming" ? "running" : "complete",
    });
  }

  // Code execution
  if (
    message.text?.includes("```") ||
    message.text?.includes("code") ||
    message.id.includes("code")
  ) {
    activities.push({
      id: `code-${message.id}`,
      type: "code",
      label: "Code",
      status: message.status === "streaming" ? "running" : "complete",
    });
  }

  return activities;
}

function renderSlashCommandPart(part: string, index: number) {
  if (part.startsWith("/")) {
    return (
      <span key={`${part}-${index}`} className="text-amber-400/90 font-mono">
        {part}
      </span>
    );
  }

  return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
}

interface ChatMessageBodyProps {
  message: AgentMessageSnapshot;
  feedback: FeedbackValue | null;
  onFeedbackChange: (value: FeedbackValue) => void;
  onCopy: () => void;
  index: number;
}

function ChatMessageBody({
  message,
  feedback,
  onFeedbackChange,
  onCopy,
  index,
}: ChatMessageBodyProps) {
  const activities = extractActivitiesFromMessage(message);

  switch (message.role) {
    case "system":
      return (
        <SystemMessage
          tone={message.status === "error" ? "error" : "info"}
          title="System"
        >
          {message.text}
        </SystemMessage>
      );
    case "tool":
      return (
        <div className="w-full">
          <Tool toolPart={buildToolPart(message)} defaultOpen={false} />
        </div>
      );
    case "user":
      return (
        <div className="w-full space-y-1">
          <div className="max-w-none text-sm leading-6 text-white/70">
            <SlashCommandHighlighter text={message.text || " "} />
          </div>
        </div>
      );
    default:
      if (message.status === "error") {
        return (
          <SystemMessage tone="error" title="Error">
            {message.text || "Pi failed to complete the response."}
          </SystemMessage>
        );
      }

      return (
        <div className="w-full space-y-2">
          {/* Activities for this message */}
          {activities.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-1">
              {activities.map((activity) => (
                <ActivityIndicator
                  key={activity.id}
                  type={activity.type}
                  label={activity.label}
                  status={
                    activity.status === "running" ? "running" : "complete"
                  }
                />
              ))}
            </div>
          )}

          <EnhancedMessage
            id={message.id}
            role="assistant"
            content={message.text || " "}
            isMarkdown={true}
            status={message.status}
            activities={activities.filter(
              (a) => a.status === "running" || a.status === "complete",
            )}
            feedback={feedback}
            onFeedbackChange={onFeedbackChange}
            onCopy={onCopy}
            animationIndex={index}
          />
        </div>
      );
  }
}

const MemoizedChatMessageBody = React.memo(ChatMessageBody);

const ChatMessageRow = React.memo(function ChatMessageRow({
  message,
  index,
  feedback,
  onFeedbackChange,
  onCopyMessage,
}: ChatMessageRowProps) {
  const isSystem = message.role === "system";
  const isTool = message.role === "tool";
  const isAssistant = message.role === "assistant";
  const isUser = message.role === "user";

  // Tighter vertical spacing
  return (
    <div
      className={cn(
        "group flex w-full flex-col px-0 py-2",
        isUser && "justify-end items-end",
        isAssistant && "justify-start items-start",
        (isSystem || isTool) && "justify-center items-center",
        "stagger-item",
      )}
      style={{ animationDelay: `${(index % 8) * 30}ms` }}
    >
      <div
        className={cn(
          "min-w-0 flex flex-col gap-1 w-full max-w-3xl mx-auto px-6",
          isUser && "items-end",
          isAssistant && "items-start",
          (isSystem || isTool) && "items-center",
        )}
      >
        <div
          className={cn(
            "w-full text-sm leading-6",
            isUser && "text-white/70 text-right",
            isAssistant && "text-white/70",
            (isSystem || isTool) && "text-white/40",
          )}
        >
          <MemoizedChatMessageBody
            message={message}
            feedback={feedback}
            onFeedbackChange={(value) => onFeedbackChange(message.id, value)}
            onCopy={() => onCopyMessage(message.text)}
            index={index}
          />
        </div>
      </div>
    </div>
  );
});

// Slash command highlighter component
interface SlashCommandHighlighterProps {
  text: string;
}

function SlashCommandHighlighter({ text }: SlashCommandHighlighterProps) {
  const parts = text.split(/(\/[a-zA-Z0-9_-]+)/g);
  return <>{parts.map(renderSlashCommandPart)}</>;
}

function getLastErrorTitle(lastError: string): string {
  const normalized = lastError.toLowerCase();

  if (normalized.includes("token")) {
    return "Token limit reached";
  }

  if (normalized.includes("model")) {
    return "Model error";
  }

  return "Error";
}

// Detect running activities from messages
function detectRunningActivities(messages: AgentMessageSnapshot[]): Array<{
  id: string;
  type: ActivityIndicatorProps["type"];
  label: string;
  status: "running";
  details?: string;
}> {
  const activities: Array<{
    id: string;
    type: ActivityIndicatorProps["type"];
    label: string;
    status: "running";
    details?: string;
  }> = [];

  // Check for streaming tool messages
  const streamingTools = messages.filter(
    (m) => m.role === "tool" && m.status === "streaming",
  );

  for (const tool of streamingTools) {
    const toolNameMatch = /^tool:([^:]+):/.exec(tool.id);
    const toolName = toolNameMatch?.[1] ?? "tool";
    activities.push({
      id: `streaming-${tool.id}`,
      type: "tool",
      label: toolName,
      status: "running",
      details: "Processing...",
    });
  }

  return activities;
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

  // Detect streaming activities
  const streamingActivities = React.useMemo(
    () => detectRunningActivities(messages),
    [messages],
  );

  // Enhanced streaming indicator with shimmer
  const streamingIndicator = isStreaming ? (
    <div className="mx-auto flex w-full max-w-3xl px-6 py-2">
      <StreamingIndicator
        message="Pi is responding"
        activities={streamingActivities}
      />
    </div>
  ) : null;

  const hasConversationState =
    messages.length > 0 || isStreaming || lastError !== null;

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
            "flex w-full min-h-full flex-1 flex-col px-0 select-text",
            messages.length > 0 && "pb-24",
          )}
        >
          {!hasConversationState ? (
            <div
              data-testid="chat-empty-state"
              className="flex min-h-full w-full flex-1 items-center justify-center px-6"
            >
              <div className="max-w-md text-center font-mono text-[14px] uppercase tracking-[0.08em] text-white/25">
                Start a conversation with Pi.
              </div>
            </div>
          ) : null}

          {messages.length > 0
            ? messages.map((message, index) => {
                const feedbackValue = feedbackByMessageId[message.id] ?? null;

                return (
                  <ChatMessageRow
                    key={message.id}
                    message={message}
                    index={index}
                    feedback={feedbackValue}
                    onFeedbackChange={handleFeedbackChange}
                    onCopyMessage={handleCopyMessage}
                  />
                );
              })
            : null}

          {streamingIndicator}

          {/* Error message */}
          {lastError && (
            <div className="mx-auto w-full max-w-3xl px-6 py-2">
              <SystemMessage tone="error" title={getLastErrorTitle(lastError)}>
                {lastError}
              </SystemMessage>
            </div>
          )}

          {hasConversationState ? <ChatContainerScrollAnchor /> : null}
        </ChatContainerContent>
      </ChatContainerRoot>

      {/* Scroll button — above input */}
      {showScrollButton && (
        <div className="pointer-events-none absolute bottom-28 right-6 z-10">
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
