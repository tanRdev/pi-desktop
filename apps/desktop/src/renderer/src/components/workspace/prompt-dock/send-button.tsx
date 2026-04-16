import { PromptInputAction } from "@pi-desktop/ui";
import { ArrowUp, ICON_SIZE_XS, Square } from "@/components/ui/icons";
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
        size="icon"
        disabled={disabled}
        onClick={onSubmit}
        className={cn(
          "size-6 p-0",
          !isPromptExecuting && (!canSend || !draft.trim())
            ? "bg-white/15 text-white/30"
            : !isPromptExecuting
              ? "bg-white/80 text-black hover:bg-white"
              : "bg-[var(--color-error)] hover:bg-[var(--color-error)]/90",
        )}
      >
        {isPromptExecuting ? (
          <Square className={ICON_SIZE_XS} fill="currentColor" />
        ) : (
          <ArrowUp className="size-3" weight="bold" />
        )}
      </Button>
    </PromptInputAction>
  );
}
