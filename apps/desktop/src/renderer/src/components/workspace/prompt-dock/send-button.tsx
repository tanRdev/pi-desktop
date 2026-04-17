import { PromptInputAction } from "@pi-desktop/ui";
import { ArrowUp, Square } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";

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
        className={cn(
          !isPromptExecuting &&
            !disabled &&
            "bg-white text-[var(--color-bg-secondary)] hover:bg-white/90",
        )}
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
