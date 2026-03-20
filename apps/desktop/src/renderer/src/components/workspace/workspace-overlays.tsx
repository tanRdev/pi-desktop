import type { SearchMatch, WorktreeSnapshot } from "@pidesk/shared";
import { FolderTree, GitBranch, Search } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  type SearchWindowAction,
  SearchWindowContent,
} from "../canvas/search-window-content";
import { FileTree } from "../ui/file-tree";
import { ScrollArea } from "../ui/scroll-area";

interface WorkspaceOverlayFrameProps {
  ariaLabel: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}

function WorkspaceOverlayFrame({
  ariaLabel,
  onClose,
  className,
  children,
}: WorkspaceOverlayFrameProps) {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[#050505]/72 px-4 pb-10 pt-16 backdrop-blur-[3px] sm:px-6 sm:pt-20">
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onKeyDown={(event) => event.stopPropagation()}
        className={cn(
          "relative z-10 flex w-full flex-col overflow-hidden border border-[#474747]/30 bg-[#101010] shadow-[0_24px_100px_rgba(0,0,0,0.45)]",
          "motion-safe:animate-[window-enter_0.16s_var(--ease-out)_forwards]",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export interface LauncherOverlayProps {
  ariaLabel: string;
  projectName: string;
  activeWorktreeLabel: string | null;
  query: string;
  isLoading: boolean;
  results: SearchMatch[];
  selectedIndex: number;
  actions: SearchWindowAction[];
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (match: SearchMatch) => void;
  onHover: (index: number) => void;
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
}

export function LauncherOverlay({
  ariaLabel,
  projectName,
  activeWorktreeLabel,
  query,
  isLoading,
  results,
  selectedIndex,
  actions,
  onClose,
  onQueryChange,
  onSelect,
  onHover,
  onKeyDown,
}: LauncherOverlayProps) {
  return (
    <WorkspaceOverlayFrame
      ariaLabel={ariaLabel}
      onClose={onClose}
      className="max-w-3xl"
    >
      <div className="flex items-center justify-between border-b border-[#474747]/20 bg-[#0d0d0d] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-mono uppercase tracking-[0.24em] text-[#6f6f6f]">
            Launcher
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-white">
            <Search className="size-4 shrink-0 text-[#9f9f9f]" />
            <span className="truncate">{projectName}</span>
            <span className="truncate text-xs text-[#7d7d7d]">
              {activeWorktreeLabel ?? "No worktree"}
            </span>
          </div>
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#666]">
          Esc to close
        </p>
      </div>
      <div className="max-h-[min(72vh,720px)] bg-[#101010]">
        <SearchWindowContent
          query={query}
          onQueryChange={onQueryChange}
          isLoading={isLoading}
          results={results}
          selectedIndex={selectedIndex}
          onSelect={onSelect}
          onHover={onHover}
          onKeyDown={onKeyDown}
          actions={actions}
          shouldFocusInput
          className="bg-[#101010]"
        />
      </div>
    </WorkspaceOverlayFrame>
  );
}

export interface FileTreeOverlayProps {
  ariaLabel: string;
  projectName: string;
  activeWorktree: WorktreeSnapshot | null;
  onClose: () => void;
  onFileClick: (filePath: string) => void | Promise<void>;
}

export function FileTreeOverlay({
  ariaLabel,
  projectName,
  activeWorktree,
  onClose,
  onFileClick,
}: FileTreeOverlayProps) {
  const handleFileClick = React.useCallback(
    (filePath: string) => {
      void Promise.resolve(onFileClick(filePath)).finally(onClose);
    },
    [onClose, onFileClick],
  );

  return (
    <WorkspaceOverlayFrame
      ariaLabel={ariaLabel}
      onClose={onClose}
      className="max-w-3xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#474747]/20 bg-[#0d0d0d] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-mono uppercase tracking-[0.24em] text-[#6f6f6f]">
            Files
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-white">
            <FolderTree className="size-4 shrink-0 text-[#9f9f9f]" />
            <span className="truncate">{projectName}</span>
            {activeWorktree ? (
              <span className="truncate text-xs text-[#7d7d7d]">
                {activeWorktree.path}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-[#666]">
          <GitBranch className="size-3.5" />
          <span>{activeWorktree?.label ?? "No worktree"}</span>
        </div>
      </div>
      <ScrollArea className="max-h-[min(72vh,720px)] bg-[#101010]">
        <div className="p-3">
          {activeWorktree ? (
            <div className="overflow-hidden border border-[#474747]/25 bg-[#0d0d0d]">
              <div className="border-b border-[#474747]/20 bg-[#111111] px-3 py-2">
                <p className="truncate text-[10px] font-mono uppercase tracking-[0.2em] text-[#666]">
                  {activeWorktree.path}
                </p>
              </div>
              <FileTree
                rootPath={activeWorktree.path}
                onFileClick={handleFileClick}
                className="py-2"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 border border-[#474747]/25 bg-[#0d0d0d] px-6 py-12 text-center">
              <FolderTree className="size-8 text-[#5d5d5d]" />
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white">
                  Select a repository or worktree to browse files
                </p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#6f6f6f]">
                  Choose a branch on the right, then open Files again.
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </WorkspaceOverlayFrame>
  );
}
