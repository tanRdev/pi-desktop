import type { ChatThreadTurn } from "./chat/chat-thread-turns";
import { ChatThreadTranscriptTurn } from "./chat-thread-transcript-turn";

export interface ChatThreadTurnSlotProps {
  turn: ChatThreadTurn;
  isLastTurn: boolean;
  canRetryLastUser: boolean;
  onCopyMessage: (text: string) => void;
  onRetryLastUserMessage?: (text: string) => void;
  onResubmitUserMessage?: (messageId: string, nextText: string) => void;
  getMessageTokens?: (messageId: string) => number | null | undefined;
}

/**
 * One transcript turn with the transcript-level actions wired in: retry
 * is only offered on a failed last user message, and edit/resubmit only
 * on the last turn. Used as the render slot of the virtual turn list.
 */
export function ChatThreadTurnSlot({
  turn,
  isLastTurn,
  canRetryLastUser,
  onCopyMessage,
  onRetryLastUserMessage,
  onResubmitUserMessage,
  getMessageTokens,
}: ChatThreadTurnSlotProps) {
  const failedLastUser =
    isLastTurn && canRetryLastUser && turn.userMessage !== null;

  return (
    <ChatThreadTranscriptTurn
      turn={turn}
      onCopyMessage={onCopyMessage}
      getMessageTokens={getMessageTokens}
      isFailedLastUser={failedLastUser}
      onRetryLastUserMessage={
        failedLastUser ? onRetryLastUserMessage : undefined
      }
      onResubmitUserMessage={isLastTurn ? onResubmitUserMessage : undefined}
    />
  );
}
