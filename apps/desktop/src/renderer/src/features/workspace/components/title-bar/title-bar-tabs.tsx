import { cn } from "@pi-desktop/ui";
import * as React from "react";
import { Chat, File, X } from "@/components/ui/phosphor-icons";
import type {
  ContextSurfaceKey,
  ContextWindow,
} from "@/features/workspace/workspace-pane-state";

const EMPTY_CONTEXT_WINDOWS: ContextWindow[] = [];

export interface TitleBarTabsProps {
  activeThreadId?: string | null;
  activeThreadTitle?: string | null;
  contextWindows?: ContextWindow[];
  selectedContextSurface?: ContextSurfaceKey | null;
  onSelectContextSurface?: (surfaceKey: ContextSurfaceKey | null) => void;
  onCloseFileWindow?: (windowId: string) => void;
}

function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

function TitleBarTab({
  label,
  icon,
  isActive,
  isClosable,
  onSelect,
  onClose,
}: {
  label: string;
  icon: "chat" | "file";
  isActive: boolean;
  isClosable?: boolean;
  onSelect: () => void;
  onClose?: () => void;
}) {
  const Icon = icon === "chat" ? Chat : File;

  return (
    <div
      role="tab"
      tabIndex={0}
      aria-selected={isActive}
      className={cn(
        "group flex h-7 min-w-0 max-w-[160px] items-center gap-1.5 px-2",
        "text-[11px] uppercase tracking-wider transition-colors duration-150",
        "focus:outline-none focus-visible:outline-none cursor-pointer select-none",
        isActive
          ? "text-white/90 border-b border-white/20"
          : "text-white/40 hover:text-white/70 border-b border-transparent",
      )}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <Icon className="size-3 shrink-0" weight="regular" />
      <span className="truncate">{label}</span>
      {isClosable && onClose && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className={cn(
            "ml-auto shrink-0 flex size-4 items-center justify-center",
            "text-white/45 hover:text-white/60",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-100",
          )}
          aria-label={`Close ${label}`}
        >
          <X className="size-2.5" weight="bold" />
        </button>
      )}
    </div>
  );
}

export function TitleBarTabs({
  activeThreadId,
  activeThreadTitle,
  contextWindows = EMPTY_CONTEXT_WINDOWS,
  selectedContextSurface,
  onSelectContextSurface,
  onCloseFileWindow,
}: TitleBarTabsProps) {
  const fileWindows = React.useMemo(
    () =>
      contextWindows.filter(
        (window): window is Extract<ContextWindow, { kind: "file" }> =>
          window.kind === "file",
      ),
    [contextWindows],
  );

  const isChatActive =
    selectedContextSurface === null || selectedContextSurface === "activity";

  return (
    <div
      data-slot="titlebar-tabs"
      data-no-drag="true"
      className="flex min-w-0 items-center gap-0 overflow-x-auto"
      role="tablist"
    >
      {activeThreadId && (
        <TitleBarTab
          label={activeThreadTitle ?? "Chat"}
          icon="chat"
          isActive={isChatActive}
          onSelect={() => onSelectContextSurface?.(null)}
        />
      )}
      {fileWindows.map((window) => (
        <TitleBarTab
          key={window.id}
          label={getFileName(window.filePath)}
          icon="file"
          isActive={selectedContextSurface === window.id}
          isClosable
          onSelect={() => onSelectContextSurface?.(window.id)}
          onClose={
            onCloseFileWindow ? () => onCloseFileWindow(window.id) : undefined
          }
        />
      ))}
    </div>
  );
}
