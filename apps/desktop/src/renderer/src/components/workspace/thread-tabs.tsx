import type { FileWindow, ThreadSnapshot } from "@pi-desktop/shared";
import { Plus, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type FileTab = Pick<FileWindow, "id" | "title" | "isDirty">;

export interface ThreadTabsProps {
  threads: ThreadSnapshot[];
  fileTabs?: FileTab[];
  activeThreadId: string | null;
  activeFileId?: string | null;
  onSelectThread: (threadId: string) => void;
  onCloseThread: (threadId: string) => void;
  onSelectFile?: (fileId: string) => void;
  onCloseFile?: (fileId: string) => void;
  onCreateThread: () => void | Promise<void>;
}

export function ThreadTabs({
  threads,
  fileTabs = [],
  activeThreadId,
  activeFileId = null,
  onSelectThread,
  onCloseThread,
  onSelectFile,
  onCloseFile,
  onCreateThread,
}: ThreadTabsProps) {
  return (
    <div
      data-testid="thread-tabs"
      className="flex h-11 items-center border-b border-white/[0.03] bg-[var(--shell-main-bg)] px-3 select-none"
    >
      <div className="flex h-full min-w-0 flex-1 items-end gap-1 overflow-x-auto no-scrollbar select-none">
        {threads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isRunning = thread.runtime.status === "streaming";

          return (
            <div
              key={thread.id}
              className={cn(
                "group flex h-full min-w-0 max-w-[220px] flex-1 items-center gap-2 border-b px-3 text-left text-[10.5px] transition-[color,border-color] duration-[var(--duration-normal)] ease-[var(--ease-emphasized-decel)]",
                isActive
                  ? "border-white/20 text-white/80"
                  : "border-transparent text-white/40 hover:border-white/10 hover:text-white/70",
              )}
            >
              <button
                type="button"
                data-testid="thread-tab-select"
                aria-label={thread.title || "Untitled thread"}
                onClick={() => onSelectThread(thread.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <div
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 transition-all duration-300",
                    isRunning
                      ? "animate-pulse bg-[var(--color-accent)]/70 shadow-[0_0_4px_var(--color-accent-ring)]"
                      : isActive
                        ? "bg-white/25"
                        : "bg-white/12",
                  )}
                />
                <span className="flex-1 truncate font-normal">
                  {thread.title || "Untitled thread"}
                </span>
              </button>

              <button
                type="button"
                data-testid="thread-tab-close"
                aria-label={`Close ${thread.title || "thread"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseThread(thread.id);
                }}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center transition-colors duration-150",
                  isActive
                    ? "text-white/35 hover:bg-white/[0.04] hover:text-white/70"
                    : "text-white/25 hover:bg-white/[0.04] hover:text-white/60",
                  "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  isActive && "opacity-100",
                )}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        {fileTabs.map((file) => {
          const isActive = file.id === activeFileId;

          return (
            <div
              key={file.id}
              className={cn(
                "group flex h-full min-w-0 max-w-[220px] flex-1 items-center gap-2 border-b px-3 text-left text-[10.5px] transition-[color,border-color] duration-[var(--duration-normal)] ease-[var(--ease-emphasized-decel)]",
                isActive
                  ? "border-white/20 text-white/80"
                  : "border-transparent text-white/40 hover:border-white/10 hover:text-white/70",
              )}
            >
              <button
                type="button"
                aria-label={file.title}
                onClick={() => onSelectFile?.(file.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="flex-1 truncate font-normal">
                  {file.title}
                  {file.isDirty ? " *" : ""}
                </span>
              </button>

              <button
                type="button"
                aria-label={`Close ${file.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseFile?.(file.id);
                }}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center transition-colors duration-150",
                  isActive
                    ? "text-white/35 hover:bg-white/[0.04] hover:text-white/70"
                    : "text-white/25 hover:bg-white/[0.04] hover:text-white/60",
                  "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  isActive && "opacity-100",
                )}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          data-testid="create-thread-button"
          aria-label="Create thread"
          onClick={() => {
            void onCreateThread();
          }}
          className="flex h-full shrink-0 items-center justify-center px-3 text-white/30 transition-colors duration-150 hover:text-white/60"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
