"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ActivityIndicatorProps } from "./activity-indicator";
import { ActivityGroup, ActivityIndicator } from "./activity-indicator";
import { FeedbackBar, type FeedbackValue } from "./feedback-bar";
import { Markdown } from "./markdown";
import { SystemMessage } from "./system-message";
import { ThinkingBlock } from "./thinking-block";
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
  /** Feedback state */
  feedback?: FeedbackValue | null;
  /** Callback when feedback changes */
  onFeedbackChange?: (value: FeedbackValue) => void;
  /** Callback when copy is clicked */
  onCopy?: () => void;
  /** Additional className */
  className?: string;
  /** Animation index for stagger effect */
  animationIndex?: number;
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
  feedback,
  onFeedbackChange,
  onCopy,
  className,
  animationIndex = 0,
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
          <div className="w-full space-y-2">
            <div className="max-w-none text-sm leading-6 text-white/70">
              <SlashCommandHighlighter text={content || " "} />
            </div>
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
                <Markdown className="max-w-none leading-6 [&_blockquote]:my-3 [&_li]:my-0.5 [&_ol]:my-2 [&_p]:my-2 [&_pre]:my-3 [&_ul]:my-2]">
                  {content}
                </Markdown>
              ) : (
                <div className="max-w-none text-sm leading-6 text-white/70 whitespace-pre-wrap">
                  {content}
                </div>
              )}
            </div>

            {/* Feedback bar */}
            {status === "complete" && (
              <div className="flex items-center gap-2 pt-0.5 opacity-0 transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out)] group-hover:opacity-100">
                <FeedbackBar
                  value={feedback ?? null}
                  onValueChange={onFeedbackChange}
                  onCopy={onCopy}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StreamingPlaceholder() {
  return (
    <div className="flex items-center gap-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-white/30"
          style={{
            animation: `shimmer-bounce 1.4s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function SlashCommandHighlighter({ text }: { text: string }) {
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
          <div className="size-2 rounded-full bg-[var(--color-accent)]/60" />
          <div className="absolute inset-0 size-2 animate-ping rounded-full bg-[var(--color-accent)]/30" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[10.5px] font-normal text-white/70">
            {message}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10.5px] text-white/40">Generating</span>
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1 rounded-full bg-white/30"
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
