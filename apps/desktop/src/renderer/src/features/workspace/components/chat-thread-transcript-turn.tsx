import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import { cn } from "@pi-desktop/ui";
import * as React from "react";
import { EnhancedMessage } from "@/components/ui/enhanced-message";
import { SystemMessage } from "@/components/ui/system-message";
import { Tool, type ToolPart } from "@/components/ui/tool";
import type { ChatThreadTurn } from "./chat/chat-thread-turns";
import { FileChangeSummary } from "./chat/file-change-summary";
import { InlineMessageEditor, MessageActions } from "./chat/message-actions";
import { MessageTimestamp } from "./chat/message-timestamp";
import { TokenCount } from "./chat/token-count";

type ChatMessageRowProps = {
  message: AgentMessageSnapshot;
  index: number;
  onCopyMessage: (text: string) => void;
  userTimestamp?: number;
  isFailedLastUser?: boolean;
  canEditUser?: boolean;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSubmitEdit?: (text: string) => void;
  onRetry?: () => void;
  tokens?: number | null;
};

export interface ChatThreadTranscriptTurnProps {
  turn: ChatThreadTurn;
  onCopyMessage: (text: string) => void;
  getMessageTokens?: (messageId: string) => number | null | undefined;
}

const FILE_MUTATION_PREFIXES = ["write", "edit", "create", "delete"];

type ToolState = "input-streaming" | "output-available" | "output-error";

function isFileMutationTool(toolMsg: AgentMessageSnapshot): boolean {
  const match = /^tool:([^:]+):/.exec(toolMsg.id);
  const name = (match?.[1] ?? "").toLowerCase();
  if (!name) return false;
  if (FILE_MUTATION_PREFIXES.some((prefix) => name.startsWith(prefix))) {
    return true;
  }
  return name.includes("file");
}

function extractFilePath(toolMsg: AgentMessageSnapshot): string | null {
  const rest = toolMsg.id.split(":").slice(2).join(":");
  if (!rest) return null;

  const pathMatch = rest.match(/([\w./\-@]+\.[a-zA-Z0-9]+)/);
  if (pathMatch?.[1]) return pathMatch[1];

  return null;
}

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

export const ChatThreadTranscriptTurn = React.memo(
  function ChatThreadTranscriptTurn({
    turn,
    onCopyMessage,
    getMessageTokens,
  }: ChatThreadTranscriptTurnProps) {
    const toolMessages = turn.messages.filter(
      (message) => message.role === "tool",
    );
    const mutationTools = toolMessages.filter(isFileMutationTool);
    const filePaths = Array.from(
      new Set(
        mutationTools
          .map(extractFilePath)
          .filter((path): path is string => path !== null),
      ),
    );

    let runningIndex = 0;
    const renderMessage = (message: AgentMessageSnapshot) => {
      const index = runningIndex++;
      return (
        <ChatMessageRow
          key={message.id}
          message={message}
          index={index}
          onCopyMessage={onCopyMessage}
          userTimestamp={turn.userMessage?.timestamp}
          tokens={
            message.role === "assistant"
              ? getMessageTokens?.(message.id)
              : undefined
          }
        />
      );
    };

    return (
      <>
        {turn.userMessage ? renderMessage(turn.userMessage) : null}

        {turn.messages.map((message) => {
          if (message.role === "tool") {
            return (
              <div key={message.id} className="mx-auto w-full max-w-3xl px-6">
                <Tool
                  toolPart={buildToolPart(message)}
                  defaultOpen={message.status !== "complete"}
                />
              </div>
            );
          }

          return renderMessage(message);
        })}

        {mutationTools.length > 0 &&
        !turn.isStreaming &&
        turn.lastAssistantTimestamp !== null ? (
          <FileChangeSummary
            filePaths={filePaths}
            count={mutationTools.length}
          />
        ) : null}
      </>
    );
  },
);
