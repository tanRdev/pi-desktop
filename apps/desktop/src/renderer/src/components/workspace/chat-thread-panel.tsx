import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@pi-desktop/ui";
import { Skeleton } from "boneyard-js/react";
import * as React from "react";
import { Tool, type ToolPart } from "@/components/ui/tool";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ActivityIndicatorProps } from "../ui/activity-indicator";
import { StreamingIndicator } from "../ui/activity-indicator";
import { EnhancedMessage } from "../ui/enhanced-message";
import { ScrollButton } from "../ui/scroll-button";
import { SystemMessage } from "../ui/system-message";
import { FileChangeSummary } from "./chat/file-change-summary";
import { InlineMessageEditor, MessageActions } from "./chat/message-actions";
import { MessageTimestamp } from "./chat/message-timestamp";
import { ResponseDivider } from "./chat/response-divider";
import type { InlineModelPickerProps } from "./chat/thread-header";
import { TokenCount } from "./chat/token-count";

type ChatMessageRowProps = {
  message: AgentMessageSnapshot;
  index: number;
  onCopyMessage: (text: string) => void;
  userTimestamp?: number;
  /** Whether this message is the last user message that failed. */
  isFailedLastUser?: boolean;
  /** Whether this user message can be edited/resubmitted. */
  canEditUser?: boolean;
  /** Whether this user row is currently being edited inline. */
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSubmitEdit?: (text: string) => void;
  onRetry?: () => void;
  /** Optional token count for assistant messages. */
  tokens?: number | null;
};

interface ChatTurn {
  id: string;
  userMessage: AgentMessageSnapshot | null;
  messages: AgentMessageSnapshot[];
  lastAssistantTimestamp: number | null;
  isStreaming: boolean;
}

function buildTurns(messages: AgentMessageSnapshot[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let current: ChatTurn | null = null;

  for (const m of messages) {
    if (m.role === "user") {
      if (current) turns.push(current);
      current = {
        id: m.id,
        userMessage: m,
        messages: [],
        lastAssistantTimestamp: null,
        isStreaming: false,
      };
      continue;
    }

    if (!current) {
      current = {
        id: `pre-turn-${m.id}`,
        userMessage: null,
        messages: [],
        lastAssistantTimestamp: null,
        isStreaming: false,
      };
    }

    current.messages.push(m);
    if (m.status === "streaming") {
      current.isStreaming = true;
    } else if (m.role === "assistant") {
      current.lastAssistantTimestamp = m.timestamp;
    }
  }
  if (current) turns.push(current);
  return turns;
}

const FILE_MUTATION_PREFIXES = ["write", "edit", "create", "delete"];

function isFileMutationTool(toolMsg: AgentMessageSnapshot): boolean {
  const match = /^tool:([^:]+):/.exec(toolMsg.id);
  const name = (match?.[1] ?? "").toLowerCase();
  if (!name) return false;
  if (FILE_MUTATION_PREFIXES.some((p) => name.startsWith(p))) return true;
  return name.includes("file");
}

function extractFilePath(toolMsg: AgentMessageSnapshot): string | null {
  // id format: tool:<name>:<rest>
  const rest = toolMsg.id.split(":").slice(2).join(":");
  if (!rest) return null;
  // Heuristic: look for something that looks like a path.
  const pathMatch = rest.match(/([\w./\-@]+\.[a-zA-Z0-9]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  return null;
}

const CHAT_SUGGESTIONS: ReadonlyArray<string> = [
  "Explain this repo",
  "What changed recently?",
  "Add a feature",
  "Find a bug",
];

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

function buildToolPart(message: AgentMessageSnapshot): ToolPart {
  const toolNameMatch = /^tool:([^:]+):/.exec(message.id);
  const hasContent = message.text && message.text.trim().length > 0;

  return {
    type: toolNameMatch?.[1] ?? "workspace.tool",
    state: getToolState(message),
    output: hasContent ? { transcript: message.text } : undefined,
    errorText: message.status === "error" ? message.text : undefined,
  };
}

interface ChatMessageBodyProps {
  message: AgentMessageSnapshot;
  onCopy: () => void;
  index: number;
  userTimestamp?: number;
}

function ChatMessageBody({
  message,
  onCopy,
  index,
  userTimestamp,
}: ChatMessageBodyProps) {
  switch (message.role) {
    case "system":
      return (
        <EnhancedMessage
          id={message.id}
          messageRole="system"
          content={message.text}
          status={message.status}
          error={message.status === "error" ? message.text : undefined}
          animationIndex={index}
        />
      );
    case "tool":
      return (
        <EnhancedMessage
          id={message.id}
          messageRole="tool"
          content={message.text}
          status={message.status}
          toolPart={buildToolPart(message)}
          animationIndex={index}
        />
      );
    case "user":
      // Skip empty user messages entirely — they produce blank bubbles
      if (!message.text?.trim()) return null;
      return (
        <EnhancedMessage
          id={message.id}
          messageRole="user"
          content={message.text}
          status={message.status}
          animationIndex={index}
          timestamp={message.timestamp}
        />
      );
    default:
      if (message.status === "error") {
        return (
          <SystemMessage tone="error" title="Error">
            {message.text || "Pi failed to complete the response."}
          </SystemMessage>
        );
      }

      // Skip empty assistant messages — they produce blank bubbles.
      // Allow streaming messages through (text may arrive momentarily).
      if (!message.text?.trim() && message.status !== "streaming") return null;
      return (
        <EnhancedMessage
          id={message.id}
          messageRole="assistant"
          content={message.text || ""}
          isMarkdown={true}
          status={message.status}
          onCopy={onCopy}
          animationIndex={index}
          timestamp={message.timestamp}
          userTimestamp={userTimestamp}
        />
      );
  }
}

const MemoizedChatMessageBody = React.memo(ChatMessageBody);

const ChatMessageRow = React.memo(function ChatMessageRow({
  message,
  index,
  onCopyMessage,
  userTimestamp,
  isFailedLastUser,
  canEditUser,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onRetry,
  tokens,
}: ChatMessageRowProps) {
  const isSystem = message.role === "system";
  const isTool = message.role === "tool";
  const isAssistant = message.role === "assistant";
  const isUser = message.role === "user";

  const showUserActions = isUser && !isEditing && Boolean(message.text?.trim());
  const showAssistantFooter =
    isAssistant &&
    message.status === "complete" &&
    Boolean(message.text?.trim());

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
          {isUser && isEditing && onSubmitEdit && onCancelEdit ? (
            <InlineMessageEditor
              initialText={message.text}
              onCancel={onCancelEdit}
              onSubmit={onSubmitEdit}
            />
          ) : (
            <MemoizedChatMessageBody
              message={message}
              onCopy={() => onCopyMessage(message.text)}
              index={index}
              userTimestamp={userTimestamp}
            />
          )}
        </div>

        {showUserActions ? (
          <div className="flex w-full flex-col items-end gap-1">
            <MessageActions
              text={message.text}
              canRetry={isFailedLastUser}
              onRetry={onRetry}
              canEdit={canEditUser}
              onStartEdit={onStartEdit}
              align="end"
            />
            <MessageTimestamp timestamp={message.timestamp} />
          </div>
        ) : null}

        {showAssistantFooter ? (
          <div className="flex w-full items-center gap-2 pt-0.5">
            <TokenCount tokens={tokens} />
            <MessageTimestamp timestamp={message.timestamp} />
          </div>
        ) : null}
      </div>
    </div>
  );
});

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

function MessageSkeleton() {
  return (
    <div className="flex w-full flex-col px-0 py-2 justify-start items-start">
      <div className="min-w-0 flex flex-col gap-1 w-full max-w-3xl mx-auto px-6">
        <div className="space-y-2 w-full">
          <div className="h-4 w-3/4 bg-white/5" />
          <div className="h-4 w-1/2 bg-white/5" />
        </div>
      </div>
    </div>
  );
}

export interface ChatThreadPanelProps {
  threadTitle: string;
  messages: AgentMessageSnapshot[];
  isStreaming: boolean;
  isLoading?: boolean;
  lastError: string | null;
  className?: string;
  /**
   * Optional retry handler for the last user message when it failed.
   * When provided, a Retry action becomes visible on the failed user row.
   */
  onRetryLastUserMessage?: (text: string) => void;
  /**
   * Optional edit+resubmit handler for the last user message. When provided,
   * user rows expose an Edit action that swaps in an inline editor.
   */
  onResubmitUserMessage?: (messageId: string, nextText: string) => void;
  /**
   * Optional token count lookup for assistant messages. Return undefined to
   * hide the token pill for that message.
   */
  getMessageTokens?: (messageId: string) => number | null | undefined;
  /**
   * Inline model picker wiring shown in the thread header. When omitted,
   * the header is still rendered without a picker.
   */
  modelPicker?: InlineModelPickerProps;
  /** Hide the thread header entirely. */
  hideHeader?: boolean;
}

export function ChatThreadPanel({
  threadTitle: _threadTitle,
  messages,
  isStreaming,
  isLoading,
  lastError,
  className,
}: ChatThreadPanelProps) {
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

  const handleCopyMessage = React.useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }, []);

  const streamingActivities = React.useMemo(
    () => detectRunningActivities(messages),
    [messages],
  );

  const turns = React.useMemo(() => buildTurns(messages), [messages]);

  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : undefined;
  const lastTurnDividerWorking =
    lastTurn !== undefined &&
    (lastTurn.isStreaming ||
      (isStreaming && lastTurn.lastAssistantTimestamp === null));
  const lastTurnShowDivider =
    lastTurn !== undefined &&
    lastTurn.userMessage !== null &&
    (lastTurn.messages.some((m) => m.role === "assistant") ||
      lastTurn.isStreaming ||
      isStreaming);

  const streamingIndicator = isStreaming ? (
    <output
      className="mx-auto flex w-full max-w-3xl px-6 py-2"
      aria-live="polite"
    >
      <StreamingIndicator
        message="Pi is responding"
        activities={streamingActivities}
      />
    </output>
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
      <ChatContainerRoot
        className="min-h-0 flex-1"
        onScroll={handleTranscriptScroll}
      >
        <ChatContainerContent
          data-testid="chat-transcript"
          className={cn(
            "flex w-full min-h-full flex-1 flex-col px-0 select-text",
            messages.length > 0 && "pb-32",
          )}
        >
          {isLoading ? (
            <Skeleton
              name="chat-messages"
              loading={true}
              fixture={[1, 2, 3].map((i) => <MessageSkeleton key={i} />)}
            >
              {null}
            </Skeleton>
          ) : (
            <>
              {!hasConversationState ? (
                <div
                  data-testid="chat-empty-state"
                  className="flex min-h-full w-full flex-1 items-center justify-center px-6"
                >
                  <div className="flex max-w-md flex-col items-center gap-6 text-center">
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-white/25">
                      Start a conversation with Pi.
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {CHAT_SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent("pi-chat-suggestion", {
                                detail: suggestion,
                              }),
                            )
                          }
                          className={cn(
                            "inline-flex items-center rounded-none px-2.5 py-1",
                            "text-[10.5px] text-white/40",
                            "border border-white/[0.06] bg-white/[0.01]",
                            "transition-colors duration-[var(--duration-fast)]",
                            "hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/70",
                            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent-ring)]",
                          )}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {turns.length > 0
                ? turns.map((turn) => {
                    const toolMessages = turn.messages.filter(
                      (m) => m.role === "tool",
                    );
                    const mutationTools =
                      toolMessages.filter(isFileMutationTool);
                    const filePaths = Array.from(
                      new Set(
                        mutationTools
                          .map(extractFilePath)
                          .filter((p): p is string => p !== null),
                      ),
                    );

                    let runningIndex = 0;
                    const renderMessage = (m: AgentMessageSnapshot) => {
                      const idx = runningIndex++;
                      return (
                        <ChatMessageRow
                          key={m.id}
                          message={m}
                          index={idx}
                          onCopyMessage={handleCopyMessage}
                          userTimestamp={turn.userMessage?.timestamp}
                        />
                      );
                    };

                    return (
                      <React.Fragment key={turn.id}>
                        {turn.userMessage
                          ? renderMessage(turn.userMessage)
                          : null}

                        {turn.messages.map((m) => {
                          if (m.role === "tool") {
                            return (
                              <div
                                key={m.id}
                                className="mx-auto w-full max-w-3xl px-6"
                              >
                                <Tool
                                  toolPart={buildToolPart(m)}
                                  defaultOpen={m.status !== "complete"}
                                />
                              </div>
                            );
                          }
                          return renderMessage(m);
                        })}

                        {mutationTools.length > 0 &&
                          !turn.isStreaming &&
                          turn.lastAssistantTimestamp !== null && (
                            <FileChangeSummary
                              filePaths={filePaths}
                              count={mutationTools.length}
                            />
                          )}
                      </React.Fragment>
                    );
                  })
                : null}

              {lastError && (
                <div className="mx-auto w-full max-w-3xl px-6 py-2">
                  <SystemMessage
                    tone="error"
                    title={getLastErrorTitle(lastError)}
                  >
                    {lastError}
                  </SystemMessage>
                </div>
              )}

              {lastTurnShowDivider && (
                <div className="mt-auto">
                  <ResponseDivider
                    userTimestamp={
                      lastTurn.userMessage?.timestamp ?? Date.now()
                    }
                    assistantCompletedAt={lastTurn.lastAssistantTimestamp}
                    isWorking={lastTurnDividerWorking}
                  />
                </div>
              )}

              {hasConversationState ? <ChatContainerScrollAnchor /> : null}
            </>
          )}
        </ChatContainerContent>
      </ChatContainerRoot>

      {/* Streaming indicator pinned above prompt dock, outside scroll area */}
      {streamingIndicator && (
        <div className="shrink-0 border-t border-white/[0.04] bg-[var(--shell-main-bg)]">
          {streamingIndicator}
        </div>
      )}

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
