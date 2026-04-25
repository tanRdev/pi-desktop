import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import {
  ChatContainerContent,
  ChatContainerScrollAnchor,
  cn,
} from "@pi-desktop/ui";
import { Skeleton } from "boneyard-js/react";
import * as React from "react";
import type { ActivityIndicatorProps } from "@/components/ui/activity-indicator";
import { SystemMessage } from "@/components/ui/system-message";
import type { ChatThreadTurn } from "./chat/chat-thread-turns";
import { ResponseDivider } from "./chat/response-divider";
import { ChatThreadTranscriptTurn } from "./chat-thread-transcript-turn";

const CHAT_SUGGESTIONS: ReadonlyArray<string> = [
  "Explain this repo",
  "What changed recently?",
  "Add a feature",
  "Find a bug",
];

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

export interface ChatThreadTranscriptProps {
  messages: AgentMessageSnapshot[];
  turns: ChatThreadTurn[];
  isLoading?: boolean;
  isStreaming: boolean;
  lastError: string | null;
  onCopyMessage: (text: string) => void;
  getMessageTokens?: (messageId: string) => number | null | undefined;
}

export function detectRunningActivities(
  messages: AgentMessageSnapshot[],
): Array<{
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
    (message) => message.role === "tool" && message.status === "streaming",
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

export function ChatThreadTranscript({
  messages,
  turns,
  isLoading,
  isStreaming,
  lastError,
  onCopyMessage,
  getMessageTokens,
}: ChatThreadTranscriptProps) {
  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : undefined;
  const lastTurnDividerWorking =
    lastTurn !== undefined &&
    (lastTurn.isStreaming ||
      (isStreaming && lastTurn.lastAssistantTimestamp === null));
  const lastTurnShowDivider =
    lastTurn !== undefined &&
    lastTurn.userMessage !== null &&
    (lastTurn.messages.some((message) => message.role === "assistant") ||
      lastTurn.isStreaming ||
      isStreaming);
  const hasConversationState =
    messages.length > 0 || isStreaming || lastError !== null;

  return (
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
          fixture={[1, 2, 3].map((index) => <MessageSkeleton key={index} />)}
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
                <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/50">
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
                        "text-[11px] text-white/40",
                        "border border-white/[0.06] bg-white/[0.01]",
                        "transition-colors duration-[var(--duration-fast)]",
                        "hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/70",
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
                return (
                  <React.Fragment key={turn.id}>
                    <ChatThreadTranscriptTurn
                      turn={turn}
                      onCopyMessage={onCopyMessage}
                      getMessageTokens={getMessageTokens}
                    />
                  </React.Fragment>
                );
              })
            : null}

          {lastError ? (
            <div className="mx-auto w-full max-w-3xl px-6 py-2">
              <SystemMessage tone="error" title={getLastErrorTitle(lastError)}>
                {lastError}
              </SystemMessage>
            </div>
          ) : null}

          {lastTurnShowDivider ? (
            <div className="mt-auto">
              <ResponseDivider
                userTimestamp={lastTurn.userMessage?.timestamp ?? Date.now()}
                assistantCompletedAt={lastTurn.lastAssistantTimestamp}
                isWorking={lastTurnDividerWorking}
              />
            </div>
          ) : null}

          {hasConversationState ? <ChatContainerScrollAnchor /> : null}
        </>
      )}
    </ChatContainerContent>
  );
}
