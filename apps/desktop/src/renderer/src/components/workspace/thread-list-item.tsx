import type { ThreadSnapshot } from "@pidesk/shared";
import { MessageSquare, Pencil, X } from "lucide-react";
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
    // Using div with role="button" to avoid nesting interactive <button> elements (invalid HTML).
    // biome-ignore lint/a11y/useSemanticElements: contains nested interactive buttons for close/rename
    <div
      role="button"
      tabIndex={0}
      onClick={isEditing ? undefined : onClick}
      onKeyDown={(e) => {
        if (!isEditing && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        isActive
          ? "bg-surface-3/80 text-foreground"
          : "text-muted-foreground hover:text-foreground",
        !isEditing && "cursor-pointer",
      )}
    >
      <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={handleConfirmRename}
            onClick={(e) => e.stopPropagation()}
            className="block w-full rounded-sm border border-border bg-surface-2 px-1 py-0 text-sm text-foreground outline-none focus:border-accent"
          />
        ) : (
          <span
            data-testid={isActive ? "current-thread-title" : undefined}
            className="block truncate text-sm"
          >
            {thread.title || "Untitled thread"}
          </span>
        )}
      </div>
      {!isEditing && onRename && (
        <button
          type="button"
          onClick={handleStartRename}
          className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-surface-3 group-hover:opacity-100"
          aria-label="Rename thread"
          title="Rename thread"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
      {!isEditing && onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-surface-3 group-hover:opacity-100"
          aria-label="Close thread"
          title="Close thread"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
