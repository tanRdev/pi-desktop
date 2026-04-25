import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import { ChatContainerRoot, cn } from "@pi-desktop/ui";
import * as React from "react";
import { StreamingIndicator } from "@/components/ui/activity-indicator";
import { ScrollButton } from "@/components/ui/scroll-button";
import { toast } from "@/lib/toast";
import { buildChatTurns } from "./chat/chat-thread-turns";
import type { InlineModelPickerProps } from "./chat/thread-header";
import {
  ChatThreadTranscript,
  detectRunningActivities,
} from "./chat-thread-transcript";

export interface ChatThreadPanelProps {
  threadTitle: string;
  messages: AgentMessageSnapshot[];
  isStreaming: boolean;
  isLoading?: boolean;
  lastError: string | null;
  className?: string;
  targetMessageId?: string | null;
  onTargetMessageNavigated?: (messageId: string) => void;
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
  targetMessageId,
  onTargetMessageNavigated,
  getMessageTokens,
}: ChatThreadPanelProps) {
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const [queuedMessageCount, setQueuedMessageCount] = React.useState(0);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
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

  const turns = React.useMemo(() => buildChatTurns(messages), [messages]);

  React.useEffect(() => {
    if (!targetMessageId) {
      return;
    }

    if (!messages.some((message) => message.id === targetMessageId)) {
      return;
    }

    const targetMessage = panelRef.current?.querySelector<HTMLElement>(
      `[data-message-id="${targetMessageId}"]`,
    );
    if (!targetMessage) {
      return;
    }

    targetMessage.scrollIntoView({ block: "center" });
    onTargetMessageNavigated?.(targetMessageId);
  }, [messages, onTargetMessageNavigated, targetMessageId]);

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

  return (
    <div
      ref={panelRef}
      className={cn(
        "relative flex h-full min-h-0 flex-col bg-[var(--shell-main-bg)] select-none",
        className,
      )}
    >
      <ChatContainerRoot
        className="min-h-0 flex-1"
        onScroll={handleTranscriptScroll}
      >
        <ChatThreadTranscript
          messages={messages}
          turns={turns}
          isLoading={isLoading}
          isStreaming={isStreaming}
          lastError={lastError}
          onCopyMessage={handleCopyMessage}
          getMessageTokens={getMessageTokens}
        />
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
