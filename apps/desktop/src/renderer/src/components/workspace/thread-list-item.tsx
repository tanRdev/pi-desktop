import type { ThreadSnapshot } from "@pidesk/shared";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ThreadListItemProps {
  thread: ThreadSnapshot;
  isActive: boolean;
  onClick: () => void;
}

function formatPreview(timestamp: number | null): string {
  if (!timestamp) {
    return "No activity";
  }

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "Just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ThreadListItem({
  thread,
  isActive,
  onClick,
}: ThreadListItemProps) {
  const isRunning = thread.runtime.status === "streaming";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition",
        isActive
          ? "bg-surface-3 text-foreground"
          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {/* Status indicator */}
      <div className="mt-1.5 flex shrink-0">
        <span
          className={cn(
            "h-2 w-2 rounded-full transition-all",
            isRunning
              ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
              : "bg-zinc-500",
          )}
        />
      </div>

      {/* Thread info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3 shrink-0 opacity-70" />
          <span
            data-testid={isActive ? "current-thread-title" : undefined}
            className="truncate text-xs font-medium"
          >
            {thread.title || "Untitled thread"}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[10px] opacity-60">
          {formatPreview(thread.lastActivityAt)}
        </div>
      </div>
    </button>
  );
}
