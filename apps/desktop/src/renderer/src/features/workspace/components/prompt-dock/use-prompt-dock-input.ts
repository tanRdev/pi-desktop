import * as React from "react";
import { toast } from "@/lib/toast";
import { usePromptHistory } from "./prompt-history";

export interface UsePromptDockInputOptions {
  activeThreadId: string | null;
  draft: string;
  isPromptExecuting: boolean;
  autocompleteVisible: boolean;
  onDraftChange: (draft: string) => void;
  onSend: () => void | Promise<void>;
  onCancelPrompt: () => void | Promise<void>;
  onPromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

export interface PromptDockInputController {
  handleImagePaste: (file: File) => void;
  handleSubmit: () => void;
  handlePromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

export function usePromptDockInput({
  activeThreadId,
  draft,
  isPromptExecuting,
  autocompleteVisible,
  onDraftChange,
  onSend,
  onCancelPrompt,
  onPromptKeyDown,
}: UsePromptDockInputOptions): PromptDockInputController {
  const history = usePromptHistory(activeThreadId);
  const handleImagePaste = React.useCallback((_file: File) => {
    toast.info("Paste image isn't supported yet", {
      description: "Use Attach files to add images to your prompt.",
    });
  }, []);

  const handleSubmit = React.useCallback(() => {
    if (!isPromptExecuting && draft.trim().length > 0) {
      history.push(draft);
    }

    void (isPromptExecuting ? onCancelPrompt() : onSend());
  }, [draft, history, isPromptExecuting, onCancelPrompt, onSend]);

  const handlePromptKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleSubmit();
        onPromptKeyDown(event);
        return;
      }

      if (
        !autocompleteVisible &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        const target = event.currentTarget;

        if (event.key === "ArrowUp") {
          const atStart =
            target.selectionStart === 0 && target.selectionEnd === 0;

          if (atStart) {
            const previousDraft = history.previous(draft);
            if (previousDraft !== null) {
              event.preventDefault();
              onDraftChange(previousDraft);
              onPromptKeyDown(event);
              return;
            }
          }
        } else {
          const atEnd =
            target.selectionStart === target.value.length &&
            target.selectionEnd === target.value.length;

          if (atEnd) {
            const nextDraft = history.next();
            if (nextDraft !== null) {
              event.preventDefault();
              onDraftChange(nextDraft);
              onPromptKeyDown(event);
              return;
            }
          }
        }
      }

      if (event.key.length === 1 || event.key === "Backspace") {
        history.reset();
      }

      onPromptKeyDown(event);
    },
    [
      autocompleteVisible,
      draft,
      handleSubmit,
      history,
      onDraftChange,
      onPromptKeyDown,
    ],
  );

  return {
    handleImagePaste,
    handleSubmit,
    handlePromptKeyDown,
  };
}
