import type { ThreadSnapshot } from "@pidesk/shared";
import { MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ThreadListItemProps {
  thread: ThreadSnapshot;
  isActive: boolean;
  onClick: () => void;
  onClose?: () => void;
}

export function ThreadListItem({
  thread,
  isActive,
  onClick,
  onClose,
}: ThreadListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        isActive
          ? "bg-surface-3/80 text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <span
          data-testid={isActive ? "current-thread-title" : undefined}
          className="block truncate text-xs"
        >
          {thread.title || "Untitled thread"}
        </span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-surface-3 group-hover:opacity-100"
          aria-label="Close thread"
          title="Close thread"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </button>
  );
}
