import * as React from "react";
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
  pendingImages: File[];
  getObjectUrl: (file: File) => string;
  handleImagePaste: (file: File) => void;
  handleRemovePendingImage: (index: number) => void;
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
  const [pendingImages, setPendingImages] = React.useState<File[]>([]);
  const objectUrlMap = React.useRef(new Map<File, string>());

  const getObjectUrl = React.useCallback((file: File): string => {
    const existing = objectUrlMap.current.get(file);
    if (existing) {
      return existing;
    }

    const url = URL.createObjectURL(file);
    objectUrlMap.current.set(file, url);
    return url;
  }, []);

  const handleImagePaste = React.useCallback((file: File) => {
    setPendingImages((previousImages) => [...previousImages, file]);
  }, []);

  const handleRemovePendingImage = React.useCallback((index: number) => {
    setPendingImages((previousImages) => {
      const removedImage = previousImages[index];
      if (removedImage) {
        const objectUrl = objectUrlMap.current.get(removedImage);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrlMap.current.delete(removedImage);
        }
      }

      return previousImages.filter((_, imageIndex) => imageIndex !== index);
    });
  }, []);

  React.useEffect(() => {
    return () => {
      for (const objectUrl of objectUrlMap.current.values()) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrlMap.current.clear();
    };
  }, []);

  const handleSubmit = React.useCallback(() => {
    if (!isPromptExecuting && draft.trim().length > 0) {
      history.push(draft);
    }

    if (pendingImages.length > 0) {
      window.dispatchEvent(
        new CustomEvent("pi:paste-image", {
          detail: { files: pendingImages },
        }),
      );
      setPendingImages([]);
    }

    void (isPromptExecuting ? onCancelPrompt() : onSend());
  }, [
    draft,
    history,
    isPromptExecuting,
    onCancelPrompt,
    onSend,
    pendingImages,
  ]);

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
    pendingImages,
    getObjectUrl,
    handleImagePaste,
    handleRemovePendingImage,
    handleSubmit,
    handlePromptKeyDown,
  };
}
