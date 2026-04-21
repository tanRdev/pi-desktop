import type { ThreadSnapshot } from "@pi-desktop/shared";
import { ChatText, ICON_SIZE_XS, X } from "@/components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DEFAULT_UNTITLED_THREAD_TITLE } from "../../../../../thread-title-defaults";

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
      data-testid="thread-list-item"
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-1.5 px-1.5 py-1.5 text-left transition-all duration-[var(--duration-fast)]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent-ring)]",
        isActive ? "text-white/90" : "text-white/30 hover:text-white/55",
        "cursor-pointer",
      )}
    >
      <ChatText
        className={cn(
          "size-3 shrink-0 transition-colors duration-150",
          isActive
            ? "text-white/60"
            : "text-white/20 group-hover:text-white/35",
        )}
        weight="regular"
      />
      <div className="min-w-0 flex-1">
        <span
          data-testid={isActive ? "current-thread-title" : undefined}
          className={cn(
            "block truncate text-[10.5px] leading-none transition-colors duration-150",
            isActive
              ? "font-normal text-white/90"
              : "text-white/45 group-hover:text-white/60",
          )}
        >
          {thread.title || DEFAULT_UNTITLED_THREAD_TITLE}
        </span>
      </div>
      <TooltipProvider>
        {onClose && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
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
                className={cn(
                  "ml-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center opacity-0 transition-all duration-[var(--duration-fast)]",
                  "hover:bg-white/[0.1] hover:text-white/80",
                  "group-hover:opacity-100 focus-visible:opacity-100",
                )}
                aria-label="Close chat"
              >
                <X className={ICON_SIZE_XS} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Close chat</TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </button>
  );
}
