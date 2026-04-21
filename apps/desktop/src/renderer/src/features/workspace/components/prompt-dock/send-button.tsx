import { PromptInputAction } from "@pi-desktop/ui";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square } from "@/components/ui/icons";

export interface SendButtonProps {
  isPromptExecuting: boolean;
  canSend: boolean;
  draft: string;
  onSubmit: () => void;
}

export function SendButton({
  isPromptExecuting,
  canSend,
  draft,
  onSubmit,
}: SendButtonProps) {
  const disabled = isPromptExecuting ? false : !canSend || !draft.trim();

  return (
    <PromptInputAction tooltip={isPromptExecuting ? "Stop" : "Send"}>
      <Button
        type="button"
        data-testid="chat-send"
        variant={isPromptExecuting ? "destructive" : "default"}
        size="icon-sm"
        disabled={disabled}
        onClick={onSubmit}
      >
        {isPromptExecuting ? (
          <Square className="size-2.5" weight="fill" />
        ) : (
          <ArrowUp className="size-3" weight="bold" />
        )}
      </Button>
    </PromptInputAction>
  );
}
