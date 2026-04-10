import type { RepositorySnapshot } from "@pidesk/shared";
import { moveRepositorySnapshots } from "@pidesk/shared";
import * as React from "react";
import {
  Archive,
  CaretDown,
  ChatText,
  CheckCircle,
  Circle,
  CircleDashed,
  Copy,
  Folder,
  FolderPlus,
  GitBranch,
  type IconProps,
  PencilSimple,
  PlayCircle,
  Plus,
  SidebarSimple,
  SquaresFour,
  Stack,
  Trash,
  XCircle,
} from "@/components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ProjectAvatar } from "./project-avatar";

// Sidebar width for minimalist layout
export const SIDEBAR_WIDTH = 240;

function getRepositoryName(repository: RepositorySnapshot): string {
  return repository.customName?.trim() || repository.name;
}

export interface LeftRailProps {
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  width: number;
  onResize: (width: number) => void;
  onSelectRepository: (repositoryId: string) => void;
  onSelectWorktree: (worktreeId: string) => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread: (worktreeId: string) => void | Promise<void>;
  onCloseThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, title: string) => void;
  onAddRepository: () => void;
  onToggleVisible?: () => void;
  onOpenSettings?: () => void;
  onOpenFilter?: () => void;
  onNewAgent?: () => void;
  onOpenMarketplace?: () => void;
  onRenameRepository?: (repositoryId: string, name: string) => void;
  onRemoveRepository?: (repositoryId: string) => void;
  onCopyRepositoryPath?: (repositoryId: string) => void;
  onOpenInFinder?: (repositoryId: string) => void;
}

interface MockThread {
  id: string;
  title: string;
  updatedAt: string;
}

const MOCK_THREADS: Record<
  "done" | "in-review" | "in-progress" | "backlog" | "canceled",
  MockThread[]
> = {
  done: [
    { id: "d1", title: "Implement auth flow", updatedAt: "2h ago" },
    { id: "d2", title: "Fix sidebar flickering", updatedAt: "5h ago" },
  ],
  "in-review": [
    { id: "r1", title: "Add unit tests for workspace", updatedAt: "1h ago" },
  ],
  "in-progress": [
    { id: "p1", title: "Refactor chat transcript", updatedAt: "Just now" },
    { id: "p2", title: "Support slash commands", updatedAt: "10m ago" },
  ],
  backlog: [
    { id: "b1", title: "Dark mode support", updatedAt: "1d ago" },
    { id: "b2", title: "Keyboard shortcuts", updatedAt: "2d ago" },
    { id: "b3", title: "Marketplace integration", updatedAt: "3d ago" },
  ],
  canceled: [
    { id: "c1", title: "Legacy support for IE11", updatedAt: "1w ago" },
  ],
};

function TallyBars({
  count,
  maxBars = 12,
  colorClassName = "bg-white/20",
}: {
  count: number;
  maxBars?: number;
  colorClassName?: string;
}) {
  const bars = Math.min(count, maxBars);
  return (
    <div className="flex gap-[2.5px] items-center ml-2 overflow-hidden shrink-0 pointer-events-none">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 w-[1.5px] rounded-full transition-opacity group-hover/item:opacity-100 opacity-60",
            colorClassName,
          )}
        />
      ))}
      {count > maxBars && (
        <span className="text-[8px] ml-0.5 font-medium opacity-60 group-hover/item:opacity-100 text-white/60">
          +
        </span>
      )}
    </div>
  );
}

interface CategoryItemProps {
  label: string;
  icon: React.ElementType;
  count: number;
  colorClassName?: string;
  isExpanded: boolean;
  onActivate: () => void;
  onHoverActivate?: React.MouseEventHandler<HTMLButtonElement>;
  onHoverLeave?: React.MouseEventHandler<HTMLButtonElement>;
  children?: React.ReactNode;
}

function CategoryItem({
  label,
  icon: Icon,
  count,
  colorClassName,
  isExpanded,
  onActivate,
  onHoverActivate,
  onHoverLeave,
  children,
}: CategoryItemProps) {
  return (
    <div className="relative space-y-0.5">
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-1 top-1.5 bottom-0 w-px rounded-full bg-white/60 transition-opacity pointer-events-none",
          isExpanded ? "opacity-100" : "opacity-0",
        )}
      />
      <button
        type="button"
        onClick={onActivate}
        onMouseMove={onHoverActivate}
        onMouseLeave={onHoverLeave}
        onFocus={onActivate}
        className={cn(
          "flex w-full items-center justify-between px-2 py-1.5 text-[12px] rounded cursor-pointer group/item transition-colors text-white/50 hover:text-white/80",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
          <Icon className="size-3.5 shrink-0 text-white/40" />
          <span className="truncate">{label}</span>
        </div>
        <TallyBars count={count} colorClassName={colorClassName} />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out pl-4",
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="py-1 space-y-0.5">{children}</div>
      </div>
    </div>
  );
}

export function LeftRail({
  repositories,
  activeRepositoryId,
  activeWorktreeId,
  activeThreadId,
  width,
  onResize,
  onSelectRepository,
  onRenameRepository,
  onRemoveRepository,
  onCopyRepositoryPath,
  onOpenInFinder,
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
  onCloseThread,
  onRenameThread,
  onAddRepository,
  onToggleVisible,
  onOpenSettings,
  onOpenMarketplace,
}: LeftRailProps) {
  const [orderedRepositories, setOrderedRepositories] =
    React.useState(repositories);
  const [draggedRepositoryId, setDraggedRepositoryId] = React.useState<
    string | null
  >(null);
  const [isResizing, setIsResizing] = React.useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<{
    isOpen: boolean;
    x: number;
    y: number;
    repositoryId: string | null;
    repositoryName: string;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    repositoryId: null,
    repositoryName: "",
  });

  const contextMenuRef = React.useRef<HTMLDivElement>(null);
  const renameInputRef = React.useRef<HTMLInputElement>(null);
  const [renameState, setRenameState] = React.useState<{
    repositoryId: string;
    value: string;
  } | null>(null);

  const [expandedCategoryId, setExpandedCategoryId] = React.useState<
    string | null
  >("in-progress");
  const hoverIntentCategoryRef = React.useRef<string | null>(null);
  const hoverIntentTimeoutRef = React.useRef<number | null>(null);
  const hoverSwitchLockUntilRef = React.useRef(0);

  const clearHoverIntent = React.useCallback(() => {
    if (hoverIntentTimeoutRef.current !== null) {
      window.clearTimeout(hoverIntentTimeoutRef.current);
      hoverIntentTimeoutRef.current = null;
    }

    hoverIntentCategoryRef.current = null;
  }, []);

  const lockHoverSwitching = React.useCallback(() => {
    hoverSwitchLockUntilRef.current = Date.now() + 220;
  }, []);

  const activateCategory = React.useCallback(
    (categoryId: string) => {
      clearHoverIntent();
      lockHoverSwitching();
      setExpandedCategoryId(categoryId);
    },
    [clearHoverIntent, lockHoverSwitching],
  );

  const queueHoverCategory = React.useCallback(
    (categoryId: string) => {
      const now = Date.now();

      if (
        expandedCategoryId !== categoryId &&
        now < hoverSwitchLockUntilRef.current
      ) {
        return;
      }

      if (expandedCategoryId === categoryId) {
        clearHoverIntent();
        return;
      }

      if (hoverIntentCategoryRef.current === categoryId) {
        return;
      }

      clearHoverIntent();
      hoverIntentCategoryRef.current = categoryId;
      hoverIntentTimeoutRef.current = window.setTimeout(() => {
        hoverIntentCategoryRef.current = null;
        hoverIntentTimeoutRef.current = null;
        lockHoverSwitching();
        setExpandedCategoryId(categoryId);
      }, 140);
    },
    [clearHoverIntent, expandedCategoryId, lockHoverSwitching],
  );

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(360, e.clientX));
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, onResize]);

  // Close context menu on click outside
  React.useEffect(() => {
    if (!contextMenu.isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu.isOpen]);

  const persistRepositoryOrder = React.useCallback(
    async (nextRepositories: RepositorySnapshot[]) => {
      await window.pidesk.repositories.reorder(
        nextRepositories.map((repository) => repository.id),
      );
    },
    [],
  );

  React.useEffect(() => {
    setOrderedRepositories(repositories);
  }, [repositories]);

  React.useEffect(() => {
    if (!renameState) {
      return;
    }

    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renameState]);

  const handleDrop = React.useCallback(
    (targetRepositoryId: string) => {
      if (!draggedRepositoryId) {
        return;
      }

      setOrderedRepositories((currentRepositories) => {
        const nextRepositories = moveRepositorySnapshots(
          currentRepositories,
          draggedRepositoryId,
          targetRepositoryId,
        );

        if (nextRepositories !== currentRepositories) {
          void persistRepositoryOrder(nextRepositories);
        }

        return nextRepositories;
      });
      setDraggedRepositoryId(null);
    },
    [draggedRepositoryId, persistRepositoryOrder],
  );

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent, repository: RepositorySnapshot) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        repositoryId: repository.id,
        repositoryName: getRepositoryName(repository),
      });
    },
    [],
  );

  const handleMenuAction = React.useCallback((action: () => void) => {
    action();
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const activeRepository = repositories.find(
    (repo) => repo.id === activeRepositoryId,
  );
  const activeRepositoryName = activeRepository
    ? getRepositoryName(activeRepository)
    : "Empty workspace";

  return (
    <aside
      data-testid="left-rail"
      data-mode="workspace"
      className={cn(
        "relative z-20 flex h-full shrink-0 select-none flex-col",
        // Minimalist: Clean dark surface with subtle border
        "bg-[#0a0a0a]",
        "border-r border-white/[0.06]",
      )}
      style={{ width }}
    >
      {/* Drag region for macOS traffic lights */}
      <div
        data-drag-region="true"
        className="flex h-11 w-full shrink-0 items-center justify-end px-3"
      >
        <button
          type="button"
          onClick={onToggleVisible}
          data-no-drag="true"
          className="flex size-7 items-center justify-center rounded-md text-white/30 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/60"
        >
          <SidebarSimple className="size-4" />
        </button>
      </div>

      {/* Repository List */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <div className="px-3 py-2 flex items-center justify-between group">
          <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider truncate mr-2">
            {activeRepositoryName}
          </div>
          <div className="flex gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onAddRepository}
                  className="text-white/40 hover:text-white/80 p-0.5"
                >
                  <Folder className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">New workspace</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() =>
                    activeWorktreeId && onCreateThread(activeWorktreeId)
                  }
                  className={cn(
                    "text-white/40 p-0.5 transition-colors",
                    activeWorktreeId
                      ? "hover:text-white/80"
                      : "opacity-20 cursor-not-allowed",
                  )}
                >
                  <Plus className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {activeWorktreeId
                  ? "New worktree"
                  : "Select a workspace to create a thread"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="space-y-0.5 px-2">
          <CategoryItem
            label="Done"
            icon={CheckCircle}
            count={MOCK_THREADS.done.length}
            isExpanded={expandedCategoryId === "done"}
            onActivate={() => activateCategory("done")}
            onHoverActivate={() => queueHoverCategory("done")}
            onHoverLeave={clearHoverIntent}
          >
            {MOCK_THREADS.done.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-white/40 hover:bg-white/[0.04] hover:text-white/70"
              >
                <ChatText className="size-3 opacity-50" />
                <span className="truncate flex-1">{thread.title}</span>
                <span className="text-[9px] opacity-30">
                  {thread.updatedAt}
                </span>
              </button>
            ))}
          </CategoryItem>

          <CategoryItem
            label="In review"
            icon={Circle}
            count={MOCK_THREADS["in-review"].length}
            colorClassName="bg-[#eab308]"
            isExpanded={expandedCategoryId === "in-review"}
            onActivate={() => activateCategory("in-review")}
            onHoverActivate={() => queueHoverCategory("in-review")}
            onHoverLeave={clearHoverIntent}
          >
            {MOCK_THREADS["in-review"].map((thread) => (
              <button
                key={thread.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-white/40 hover:bg-white/[0.04] hover:text-white/70"
              >
                <ChatText className="size-3 opacity-50" />
                <span className="truncate flex-1">{thread.title}</span>
                <span className="text-[9px] opacity-30">
                  {thread.updatedAt}
                </span>
              </button>
            ))}
          </CategoryItem>

          <CategoryItem
            label="In progress"
            icon={PlayCircle}
            count={MOCK_THREADS["in-progress"].length}
            colorClassName="bg-[#22c55e]"
            isExpanded={expandedCategoryId === "in-progress"}
            onActivate={() => activateCategory("in-progress")}
            onHoverActivate={() => queueHoverCategory("in-progress")}
            onHoverLeave={clearHoverIntent}
          >
            {MOCK_THREADS["in-progress"].map((thread) => (
              <button
                key={thread.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-white/40 hover:bg-white/[0.04] hover:text-white/70"
              >
                <ChatText className="size-3 opacity-50" />
                <span className="truncate flex-1">{thread.title}</span>
                <span className="text-[9px] opacity-30">
                  {thread.updatedAt}
                </span>
              </button>
            ))}
          </CategoryItem>

          <CategoryItem
            label="Backlog"
            icon={CircleDashed}
            count={MOCK_THREADS.backlog.length}
            isExpanded={expandedCategoryId === "backlog"}
            onActivate={() => activateCategory("backlog")}
            onHoverActivate={() => queueHoverCategory("backlog")}
            onHoverLeave={clearHoverIntent}
          >
            {MOCK_THREADS.backlog.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-white/40 hover:bg-white/[0.04] hover:text-white/70"
              >
                <ChatText className="size-3 opacity-50" />
                <span className="truncate flex-1">{thread.title}</span>
                <span className="text-[9px] opacity-30">
                  {thread.updatedAt}
                </span>
              </button>
            ))}
          </CategoryItem>

          <CategoryItem
            label="Canceled"
            icon={XCircle}
            count={MOCK_THREADS.canceled.length}
            colorClassName="bg-[#ef4444]"
            isExpanded={expandedCategoryId === "canceled"}
            onActivate={() => activateCategory("canceled")}
            onHoverActivate={() => queueHoverCategory("canceled")}
            onHoverLeave={clearHoverIntent}
          >
            {MOCK_THREADS.canceled.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-white/40 hover:bg-white/[0.04] hover:text-white/70"
              >
                <ChatText className="size-3 opacity-50" />
                <span className="truncate flex-1">{thread.title}</span>
                <span className="text-[9px] opacity-30">
                  {thread.updatedAt}
                </span>
              </button>
            ))}
          </CategoryItem>

          <div className="mt-4">
            <CategoryItem
              label="Archived"
              icon={Archive}
              count={29}
              colorClassName="bg-white/40"
              isExpanded={expandedCategoryId === "archived"}
              onActivate={() => activateCategory("archived")}
              onHoverActivate={() => queueHoverCategory("archived")}
              onHoverLeave={clearHoverIntent}
            >
              {orderedRepositories.map((repository) => {
                const repositoryName = getRepositoryName(repository);
                const isActive = repository.id === activeRepositoryId;
                return (
                  <button
                    key={repository.id}
                    type="button"
                    onClick={() => onSelectRepository(repository.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] transition-colors",
                      isActive
                        ? "bg-white/[0.04] text-white/80"
                        : "text-white/40 hover:bg-white/[0.04] hover:text-white/70",
                    )}
                  >
                    <Stack
                      className={cn(
                        "size-3",
                        isActive ? "opacity-100" : "opacity-50",
                      )}
                    />
                    <span className="truncate flex-1">{repositoryName}</span>
                  </button>
                );
              })}
            </CategoryItem>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="px-3 py-2 border-t border-white/[0.06] bg-[#0a0a0a]">
        <button
          type="button"
          data-no-drag="true"
          onClick={onOpenMarketplace}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2",
            "text-[var(--color-text-secondary)] text-[12px]",
            "transition-all duration-[var(--duration-fast)]",
            "hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]",
          )}
        >
          <SquaresFour className="size-3.5" />
          <span>Packages</span>
        </button>
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-[2px] cursor-col-resize",
          "transition-colors duration-[var(--duration-normal)]",
          "bg-transparent hover:bg-[var(--color-border-strong)]",
          isResizing && "bg-[var(--color-text-muted)]",
        )}
        onMouseDown={() => setIsResizing(true)}
        title="Drag to resize"
        role="presentation"
        aria-hidden="true"
      />

      {/* Context Menu */}
      {contextMenu.isOpen && contextMenu.repositoryId && (
        <div
          ref={contextMenuRef}
          className={cn(
            "fixed z-[100] min-w-[160px] rounded-md border border-white/[0.06] bg-[#141414] p-1",
            "shadow-[var(--shadow-hover)]",
            "animate-in fade-in-0 zoom-in-[0.98] duration-150 ease-out",
          )}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div className="px-2 py-1.5">
            <span className="block truncate text-[10px] text-[var(--color-text-secondary)]">
              {contextMenu.repositoryName}
            </span>
          </div>
          <div className="my-1 h-px bg-[var(--color-border)]" />
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() => {
                const repository = repositories.find(
                  (entry) => entry.id === contextMenu.repositoryId,
                );
                if (!repository) {
                  return;
                }

                setRenameState({
                  repositoryId: repository.id,
                  value: repository.customName ?? repository.name,
                });
              })
            }
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <PencilSimple className="size-3" />
            <span>Rename</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() =>
                onCopyRepositoryPath?.(contextMenu.repositoryId!),
              )
            }
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Copy className="size-3" />
            <span>Copy path</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() =>
                onOpenInFinder?.(contextMenu.repositoryId!),
              )
            }
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Folder className="size-3" />
            <span>Open in Finder</span>
          </button>
          <div className="my-1 h-px bg-[var(--color-border)]" />
          <button
            type="button"
            onClick={() =>
              handleMenuAction(() =>
                onRemoveRepository?.(contextMenu.repositoryId!),
              )
            }
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[var(--accent-pale-red-text)]",
              "transition-colors duration-100",
              "hover:bg-[var(--accent-pale-red-bg)]",
            )}
          >
            <Trash className="size-3" />
            <span>Remove</span>
          </button>
        </div>
      )}
    </aside>
  );
}
