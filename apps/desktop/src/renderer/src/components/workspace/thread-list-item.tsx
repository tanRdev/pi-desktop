import type { ThreadSnapshot } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ChatText, ICON_SIZE_XS, ICON_SIZE_SM, PencilSimple, X } from "@/components/ui/icons";

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
        "active-accent-left group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left transition-all duration-[var(--duration-fast)]",
        isActive
          ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] active"
          : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]/60 hover:text-[var(--color-text-secondary)]",
        !isEditing && "cursor-pointer",
      )}
      data-active={isActive}
    >
      <ChatText
        className={cn(
          `${ICON_SIZE_SM} shrink-0 transition-colors`,
          isActive
            ? "text-[var(--color-accent)]"
            : "text-[var(--color-text-quaternary)] group-hover:text-[var(--color-text-tertiary)]",
        )}
        weight="regular"
      />
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
            className="block w-full rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] px-1.5 py-0.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
          />
        ) : (
          <span
            data-testid={isActive ? "current-thread-title" : undefined}
            className={cn(
              "block truncate text-[12px] leading-tight",
              isActive
                ? "font-medium text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)]",
            )}
          >
            {thread.title || "Untitled thread"}
          </span>
        )}
      </div>
      {!isEditing && onRename && (
        <div
          role="button"
          tabIndex={0}
          data-testid="thread-rename-button"
          onClick={handleStartRename}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleStartRename(e as unknown as React.MouseEvent);
            }
          }}
          className="ml-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded opacity-0 transition-all duration-[var(--duration-fast)] hover:bg-[var(--color-bg-active)] group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Rename thread"
          title="Rename thread"
        >
          <PencilSimple className={ICON_SIZE_XS} />
        </div>
      )}
      {!isEditing && onClose && (
        <div
          role="button"
          tabIndex={0}
          data-testid="thread-close-button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }
          }}
          className="ml-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded opacity-0 transition-all duration-[var(--duration-fast)] hover:bg-[var(--color-bg-active)] group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Close thread"
          title="Close thread"
        >
          <X className={ICON_SIZE_XS} />
        </div>
      )}
    </button>
  );
}
