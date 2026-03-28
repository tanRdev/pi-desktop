import { ChatText, PencilSimple, X } from "@phosphor-icons/react";
import type { ThreadSnapshot } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ThreadListItemProps {
  thread: ThreadSnapshot;
  isActive: boolean;
  onClick: () => void;
  onClose?: () => void;
  onRename?: (title: string) => void;
}

export function ThreadListItem({
  thread,
  isActive,
  onClick,
  onClose,
  onRename,
}: ThreadListItemProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleStartRename = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditValue(thread.title || "");
      setIsEditing(true);
    },
    [thread.title],
  );

  const handleConfirmRename = React.useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== thread.title && onRename) {
      onRename(trimmed);
    }
    setIsEditing(false);
  }, [editValue, thread.title, onRename]);

  const handleCancelRename = React.useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirmRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelRename();
      }
    },
    [handleConfirmRename, handleCancelRename],
  );

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <button
      data-testid="thread-list-item"
      type="button"
      onClick={isEditing ? undefined : onClick}
      className={cn(
        "group flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors",
        isActive
          ? "bg-[#27272a] text-[#e7e7e7]"
          : "text-[#6a6a6a] hover:bg-[#1a1a1a]/70 hover:text-[#8a8a8a]",
        !isEditing && "cursor-pointer",
      )}
    >
      <ChatText className="size-3 shrink-0 text-[#6a6a6a]" />
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input
            ref={inputRef}
            data-testid="thread-rename-input"
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={handleConfirmRename}
            onClick={(e) => e.stopPropagation()}
            className="block w-full rounded border border-[#3f3f46] bg-[#0a0a0a] px-1.5 py-0.5 text-xs text-[#e7e7e7] outline-none focus:border-[#3b82f6]"
          />
        ) : (
          <span
            data-testid={isActive ? "current-thread-title" : undefined}
            className="block truncate text-xs"
          >
            {thread.title || "Untitled thread"}
          </span>
        )}
      </div>
      {!isEditing && onRename && (
        <button
          type="button"
          data-testid="thread-rename-button"
          onClick={handleStartRename}
          className="ml-0.5 flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-[#3f3f46] group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Rename thread"
          title="Rename thread"
        >
          <PencilSimple className="size-2.5" />
        </button>
      )}
      {!isEditing && onClose && (
        <button
          type="button"
          data-testid="thread-close-button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-0.5 flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-[#3f3f46] group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Close thread"
          title="Close thread"
        >
          <X className="size-2.5" />
        </button>
      )}
    </button>
  );
}
