import type { AgentMessageSnapshot } from "@pidesk/shared";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@pidesk/ui";
import { cn } from "@/lib/utils";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "../ui/message";

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
      return "π";
    case "tool":
      return "{}";
    case "system":
      return "•";
    default:
      return "U";
  }
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

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-surface-1", className)}>
      {!isActiveThread ? (
        <div className="shrink-0 border-b border-border-subtle bg-surface-2/80 px-4 py-2 text-[11px] text-muted-foreground">
          Focus this chat window to link the composer to {safeThreadTitle}.
        </div>
      ) : null}
      <ChatContainerRoot className="min-h-0 flex-1">
        <ChatContainerContent className="flex flex-1 flex-col gap-5 px-5 py-5">
          {messages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border-subtle bg-surface-2/50 px-4 py-3 text-sm text-muted-foreground">
              {isActiveThread
                ? `No messages yet in ${safeThreadTitle}.`
                : `Focus ${safeThreadTitle} to load its latest transcript.`}
            </div>
          ) : (
            messages.map((message) => {
              const isSystem = message.role === "system";
              return (
                <Message
                  key={message.id}
                  className={cn(isSystem && "my-4 justify-center")}
                >
                  {!isSystem ? (
                    <MessageAvatar
                      src=""
                      alt={getMessageLabel(message)}
                      fallback={getMessageFallback(message)}
                    />
                  ) : null}
                  <div className={cn("min-w-0 flex-1", isSystem && "flex-initial")}>
                    {!isSystem ? (
                      <span className="text-sm font-medium text-muted-foreground">
                        {getMessageLabel(message)}
                      </span>
                    ) : null}
                    {isSystem ? (
                      <div className="mt-1 rounded border border-dashed border-border bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
                        {message.text}
                      </div>
                    ) : (
                      <MessageContent
                        markdown={message.role !== "user"}
                        className="mt-1 max-w-none bg-transparent p-0 text-base leading-relaxed text-foreground shadow-none"
                      >
                        {message.text || " "}
                      </MessageContent>
                    )}
                  </div>
                </Message>
              );
            })
          )}
          {isStreaming ? (
            <div className="pl-11 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              PiDesk is responding
            </div>
          ) : null}
          {lastError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              {lastError}
            </div>
          ) : null}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>
    </div>
  );
}
