import { Button, PromptInputAction } from "@pi-desktop/ui";
import { ArrowUp, Square } from "@/components/ui/phosphor-icons";

export interface SendButtonProps {
  isPromptExecuting: boolean;
  canSend: boolean;
  draft: string;
  onSubmit: () => void;
  /** Stop is a separate control from Submit (issue #10). */
  onStop: () => void;
  /** Steer is offered only when the active runtime supports it. */
  supportsSteer?: boolean;
  onSteer?: () => void;
}

/**
 * Composer actions with Stop separated from Submit:
 * - Submit always sends — while a run is active it queues a follow-up.
 * - Stop (only while executing) cancels the current run and nothing else.
 * - Steer (only while executing, when supported) redirects the run.
 */
export function SendButton({
  isPromptExecuting,
  canSend,
  draft,
  onSubmit,
  onStop,
  supportsSteer = false,
  onSteer,
}: SendButtonProps) {
  const submitDisabled = !canSend || !draft.trim();

  return (
    <>
      {isPromptExecuting && supportsSteer && onSteer ? (
        <PromptInputAction tooltip="Steer current run">
          <Button
            type="button"
            data-testid="chat-steer"
            variant="ghost"
            size="sm"
            disabled={submitDisabled}
            onClick={onSteer}
            className="h-6 px-2 text-[11px]"
          >
            Steer
          </Button>
        </PromptInputAction>
      ) : null}

      {isPromptExecuting ? (
        <PromptInputAction tooltip="Stop">
          <Button
            type="button"
            data-testid="chat-stop"
            variant="destructive"
            size="icon-sm"
            onClick={onStop}
          >
            <Square className="size-2.5" weight="fill" />
          </Button>
        </PromptInputAction>
      ) : null}

      <PromptInputAction
        tooltip={isPromptExecuting ? "Queue follow-up" : "Send"}
      >
        <Button
          type="button"
          data-testid="chat-send"
          variant="default"
          size="icon-sm"
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          <ArrowUp className="size-3" weight="bold" />
        </Button>
      </PromptInputAction>
    </>
  );
}
