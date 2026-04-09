import type { RepositorySnapshot } from "@pidesk/shared";
import { moveRepositorySnapshots } from "@pidesk/shared";
import * as React from "react";
import {
  CheckCircle,
  PlayCircle,
  CircleDashed,
  XCircle,
  Archive,
  FolderPlus,
  CaretRight,
  CaretDown,
  Circle,
  GitBranch,
  ChatText,
  Copy,
  Folder,
  Gear,
  type IconProps,
  PencilSimple,
  Pi,
  Plus,
  SquaresFour,
  Stack,
  Trash,
  SidebarSimple,
} from "@/components/ui/icons";
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
  onOpenMarketplace,
  onOpenSettings,
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

  const commitRename = React.useCallback(() => {
    if (!renameState) {
      return;
    }

    void onRenameRepository?.(renameState.repositoryId, renameState.value);
    setRenameState(null);
  }, [onRenameRepository, renameState]);

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
      <div data-drag-region="true" className="flex h-11 w-full shrink-0 items-center justify-end px-3">
        <button
          type="button"
          onClick={onToggleVisible}
          data-no-drag="true"
          className="flex size-7 items-center justify-center rounded-md text-white/30 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/60"
        >
          <SidebarSimple className="size-4" />
        </button>
      </div>

      {/* Navigation Items */}
      <div className="px-3 pb-3">
        <button
          type="button"
          data-no-drag="true"
          onClick={onOpenMarketplace}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2",
            "text-[var(--color-text-secondary)] text-[13px]",
            "transition-all duration-[var(--duration-fast)]",
            "hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]",
          )}
        >
          <SquaresFour className="size-4" />
          <span>Packages</span>
        </button>
        <button
          type="button"
          data-no-drag="true"
          onClick={onAddRepository}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2",
            "text-[var(--color-text-secondary)] text-[13px]",
            "transition-all duration-[var(--duration-fast)]",
            "hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]",
          )}
        >
          <Plus className="size-4" />
          <span>Add workspace</span>
        </button>
      </div>

      {/* Section divider */}
      <div className="mx-3 h-px bg-white/[0.06]" />

      {/* Empty state */}
      {orderedRepositories.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <Stack className="size-4 text-[var(--color-text-muted)]" />
          <div className="space-y-0.5">
            <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">
              No projects
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Open a workspace to begin
            </p>
          </div>
        </div>
      )}

      {/* Repository List */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <div className="px-3 py-2 flex items-center justify-between group">
          <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Workspaces</div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="text-white/40 hover:text-white/80 p-0.5"><Folder className="size-3.5" /></button>
            <button className="text-white/40 hover:text-white/80 p-0.5"><Plus className="size-3.5" /></button>
          </div>
        </div>

        <div className="space-y-0.5 px-2">
          {/* Mock Categories to match the design */}
          <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] rounded cursor-pointer">
            <CheckCircle className="size-4" />
            <span>Done</span>
          </div>
          
          <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-[#eab308] hover:text-[#fde047] hover:bg-white/[0.04] rounded cursor-pointer">
            <Circle className="size-4" />
            <span className="text-white/50">In review</span>
          </div>

          <div className="flex items-center justify-between px-2 py-1.5 text-[13px] text-[#22c55e] hover:text-[#4ade80] hover:bg-white/[0.04] rounded cursor-pointer">
            <div className="flex items-center gap-2">
              <PlayCircle className="size-4" />
              <span className="text-white/80">In progress</span>
            </div>
            <span className="text-[10px] bg-white/[0.06] text-white/40 px-1.5 py-0.5 rounded-full">2</span>
          </div>

          <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-white/30 hover:text-white/80 hover:bg-white/[0.04] rounded cursor-pointer">
            <CircleDashed className="size-4" />
            <span className="text-white/50">Backlog</span>
          </div>

          <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-[#ef4444] hover:text-[#f87171] hover:bg-white/[0.04] rounded cursor-pointer">
            <XCircle className="size-4" />
            <span className="text-white/50">Canceled</span>
          </div>

          <div className="mt-4 mb-1">
            <div className="flex items-center justify-between px-2 py-1.5 text-[13px] text-white/40 hover:text-white/80 hover:bg-white/[0.04] rounded cursor-pointer">
              <div className="flex items-center gap-2">
                <Archive className="size-4" />
                <span className="text-white/50">Archived</span>
              </div>
              <span className="text-[10px] bg-white/[0.06] text-white/40 px-1.5 py-0.5 rounded-full">29</span>
            </div>
            
            {/* Render actual repositories under Archived for demo */}
            <div className="pl-4 mt-1 space-y-0.5">
              {orderedRepositories.map((repository) => {
                const repositoryName = getRepositoryName(repository);
                const isActive = repository.id === activeRepositoryId;
                return (
                  <button
                    key={repository.id}
                    onClick={() => onSelectRepository(repository.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
                      isActive ? "bg-[#3b82f6]/10 text-[#3b82f6]" : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                    )}
                  >
                    <GitBranch className="size-3.5" />
                    <span className="truncate">{repositoryName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Divider above Pi branding */}
      <div className="mx-3 h-px bg-white/[0.06]" />

      {/* Pi branding - bottom */}
      <div className="px-3 py-1">
        <div className="flex items-center justify-between rounded-md px-2 py-1">
          <div className="flex items-center gap-2">
            <Pi className="size-3.5 text-[var(--color-text-secondary)]" />
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Pi Desktop v0.1.0
            </span>
          </div>
          <button
            type="button"
            data-no-drag="true"
            onClick={onOpenSettings}
            className={cn(
              "flex items-center justify-center rounded p-1",
              "text-[var(--color-text-secondary)]",
              "transition-all duration-[var(--duration-fast)]",
              "hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]",
            )}
          >
            <Gear className="size-3.5" />
          </button>
        </div>
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
            <span className="block truncate text-[11px] font-medium text-[var(--color-text-secondary)]">
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
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <PencilSimple className="size-3.5" />
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
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Copy className="size-3.5" />
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
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--color-text-primary)]",
              "transition-colors duration-100",
              "hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Folder className="size-3.5" />
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
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--accent-pale-red-text)]",
              "transition-colors duration-100",
              "hover:bg-[var(--accent-pale-red-bg)]",
            )}
          >
            <Trash className="size-3.5" />
            <span>Remove</span>
          </button>
        </div>
      )}
    </aside>
  );
}
