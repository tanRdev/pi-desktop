"use client";

import { cn } from "@pi-desktop/ui";
import * as React from "react";
import type { ActivityIndicatorProps } from "./activity-indicator";
import { ActivityGroup, ActivityIndicator } from "./activity-indicator";
import { FeedbackBar } from "./feedback-bar";
import { Markdown } from "./markdown";
import { SystemMessage } from "./system-message";
import { StreamingPlaceholder, ThinkingBlock } from "./thinking-indicator";
import { Tool, type ToolPart } from "./tool";

// ============================================
// TYPES
// ============================================

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ActivityItem {
  id: string;
  type: ActivityIndicatorProps["type"];
  label: string;
  status?: "pending" | "running" | "complete" | "error";
  duration?: string;
  details?: string;
}

export interface EnhancedMessageProps {
  /** Message ID */
  id: string;
  /** Message role */
  messageRole: MessageRole;
  /** Message content (text or markdown) */
  content: string;
  /** Whether content is markdown */
  isMarkdown?: boolean;
  /** Message status */
  status?: "complete" | "streaming" | "error";
  /** Activities/tool calls associated with this message */
  activities?: ActivityItem[];
  /** Thinking content for models that support it */
  thinking?: {
    content: string;
    status: "thinking" | "complete";
    duration?: string;
  };
  /** Tool output for tool messages */
  toolPart?: ToolPart;
  /** Error message */
  error?: string;
  /** Callback when copy is clicked */
  onCopy?: () => void;
  /** Additional className */
  className?: string;
  /** Animation index for stagger effect */
  animationIndex?: number;
  /** Message timestamp (unix ms). When provided, rendered beneath content. */
  timestamp?: number;
  /** User message timestamp for duration calculation */
  userTimestamp?: number;
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, ms / 1000);
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${mins}`;
}

// ============================================
// COMPONENTS
// ============================================

export function EnhancedMessage({
  id,
  messageRole,
  content,
  isMarkdown = false,
  status = "complete",
  activities,
  thinking,
  toolPart,
  error,
  onCopy,
  className,
  animationIndex = 0,
  timestamp,
  userTimestamp,
}: EnhancedMessageProps) {
  const isUser = messageRole === "user";
  const isAssistant = messageRole === "assistant";
  const isSystem = messageRole === "system";
  const isTool = messageRole === "tool";
  const isStreaming = status === "streaming";

  // Calculate animation delay for stagger effect
  const animationDelay = `${(animationIndex % 8) * 30}ms`;

  return (
    <div
      data-message-id={id}
      className={cn(
        "group flex w-full flex-col",
        "transition-opacity duration-[var(--duration-normal)] ease-[var(--ease-out)]",
        "motion-reduce:transition-none motion-reduce:duration-0",
        isUser && "items-end",
        isAssistant && "items-start",
        (isSystem || isTool) && "items-center",
        "stagger-item",
        className,
      )}
      style={{ animationDelay }}
    >
      <div
        className={cn(
          "min-w-0 flex flex-col gap-2 w-full max-w-3xl",
          isUser && "items-end",
          isAssistant && "items-start",
          (isSystem || isTool) && "items-center",
        )}
      >
        {/* System/Tool messages */}
        {(isSystem || isTool) && (
          <div className="w-full">
            {error ? (
              <SystemMessage tone="error" title="Error">
                {error}
              </SystemMessage>
            ) : isTool && toolPart ? (
              <Tool toolPart={toolPart} defaultOpen={status !== "complete"} />
            ) : (
              <SystemMessage tone="info" title="System">
                {content}
              </SystemMessage>
            )}
          </div>
        )}

        {/* User messages */}
        {isUser && (
          <div className="w-full space-y-1">
            <div className="max-w-none text-sm leading-6 text-white/70 text-right">
              <SlashCommandHighlighter text={content || " "} />
            </div>
            {timestamp !== undefined && (
              <div className="text-right font-mono text-[11px] text-white/50">
                {formatTimestamp(timestamp)}
              </div>
            )}
          </div>
        )}

        {/* Assistant messages */}
        {isAssistant && (
          <div className="w-full space-y-3">
            {/* Activities/Tool calls - shown above content */}
            {activities && activities.length > 0 && (
              <ActivityGroup>
                {activities.map((activity) => (
                  <ActivityIndicator
                    key={activity.id}
                    type={activity.type}
                    label={activity.label}
                    status={
                      activity.status === "running" ? "running" : "complete"
                    }
                    duration={activity.duration}
                    details={activity.details}
                  />
                ))}
              </ActivityGroup>
            )}

            {/* Thinking block */}
            {thinking && (
              <ThinkingBlock
                content={thinking.content}
                status={thinking.status}
                duration={thinking.duration}
                defaultOpen={thinking.status === "thinking"}
              />
            )}

            {/* Message content */}
            <div className="w-full">
              {isStreaming && !content ? (
                <StreamingPlaceholder />
              ) : isMarkdown ? (
                <Markdown className="max-w-none leading-6 [&_blockquote]:my-3 [&_li]:my-0.5 [&_ol]:my-2 [&_p]:my-2 [&_pre]:my-3 [&_ul]:my-2">
                  {content}
                </Markdown>
              ) : (
                <div className="max-w-none text-sm leading-6 text-white/70 whitespace-pre-wrap">
                  {content}
                </div>
              )}
            </div>

            {/* Feedback bar & Metadata */}
            {status === "complete" && (
              <div className="flex items-center gap-2 pt-0.5">
                <FeedbackBar
                  onCopy={onCopy}
                  duration={
                    timestamp && userTimestamp
                      ? `${formatDuration(timestamp - userTimestamp)} · ${formatTimestamp(timestamp)}`
                      : timestamp
                        ? formatTimestamp(timestamp)
                        : undefined
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SlashCommandHighlighter({ text }: { text: string }) {
  const parts = text.split(/(\/[a-zA-Z0-9_-]+)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("/")) {
          return (
            <span
              key={`${part}-${index}`}
              className="text-amber-400/90 font-mono"
            >
              {part}
            </span>
          );
        }
        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
      })}
    </>
  );
}

// ============================================
// STREAMING INDICATOR
// ============================================

export interface StreamingIndicatorProps {
  message?: string;
  activities?: ActivityItem[];
  className?: string;
}

export function StreamingIndicator({
  message = "Pi is responding",
  activities,
  className,
}: StreamingIndicatorProps) {
  return (
    <div
      className={cn("mx-auto flex w-full max-w-3xl flex-col gap-2", className)}
    >
      {/* Activities */}
      {activities && activities.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {activities.map((activity) => (
            <ActivityIndicator
              key={activity.id}
              type={activity.type}
              label={activity.label}
              status="running"
              details={activity.details}
            />
          ))}
        </div>
      )}

      {/* Responding indicator */}
      <div
        className={cn(
          "flex items-center gap-3 border border-white/[0.06]",
          "bg-white/[0.02] px-4 py-3",
        )}
      >
        <div className="relative">
          <div className="size-2 bg-[var(--color-accent)]/60" />
          <div className="absolute inset-0 size-2 animate-ping bg-[var(--color-accent)]/30" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-normal text-white/70">
            {message}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-white/40">Generating</span>
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1 bg-white/30"
                  style={{
                    animation: `shimmer-bounce 1.4s ease-in-out ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MESSAGE GROUP (for grouping related messages)
// ============================================

export interface MessageGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function MessageGroup({ children, className }: MessageGroupProps) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>;
}
