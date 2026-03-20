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
        "motion-safe:stagger-item group flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono",
        "transition-all duration-200 ease-out",
        "hover:bg-[#353535]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        isActive
          ? "bg-[#353535] text-[#ffffff]"
          : "text-[#ffffff]/60 hover:text-[#ffffff]",
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
            className={cn(
              "block w-full border-b border-outline-variant bg-transparent px-1 py-0 text-sm text-[#ffffff] outline-none",
              "transition-all duration-150 ease-out",
              "focus:border-primary",
            )}
          />
        ) : (
          <span
            data-testid={isActive ? "current-thread-title" : undefined}
            className="block truncate text-[12px] font-medium tracking-tight uppercase"
          >
            {thread.title || "Untitled thread"}
          </span>
        )}
      </div>
      {!isEditing && onRename && (
        <button
          type="button"
          onClick={handleStartRename}
          className={cn(
            "ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center",
            "opacity-0 transition-all duration-150 ease-out",
            "hover:bg-[#474747] hover:scale-105",
            "focus-visible:opacity-100",
            "group-hover:opacity-100",
          )}
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
          className={cn(
            "ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center",
            "opacity-0 transition-all duration-150 ease-out",
            "hover:bg-[#474747] hover:scale-105",
            "focus-visible:opacity-100",
            "group-hover:opacity-100",
          )}
          aria-label="Close thread"
          title="Close thread"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
