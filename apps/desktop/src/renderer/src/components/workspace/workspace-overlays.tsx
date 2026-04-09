import type { SearchMatch, WorktreeSnapshot } from "@pidesk/shared";
import * as React from "react";
import { FolderOpen, GitBranch, MagnifyingGlass } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { FileTree } from "../ui/file-tree";
import { ScrollArea } from "../ui/scroll-area";
import {
  type WorkspaceSearchAction as SearchWindowAction,
  WorkspaceSearchContent,
} from "./workspace-search-content";

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 select-none">
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
          "relative z-10 w-full max-w-xl overflow-hidden rounded-xl select-none",
          "bg-[#0e0e0e] border border-white/[0.06] shadow-[0_16px_48px_rgba(0,0,0,0.5)]",
          "animate-[modal-content-enter_0.15s_ease-out_forwards]",
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
    <WorkspaceOverlayFrame ariaLabel={ariaLabel} onClose={onClose}>
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <MagnifyingGlass className="size-5 text-white/20 shrink-0" />
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-sm font-medium text-white/80">
              {projectName}
            </span>
            <span className="text-xs text-white/40 truncate">
              {activeWorktreeLabel ?? "No worktree"}
            </span>
          </div>
        </div>
        <div className="max-h-[50vh]">
          <WorkspaceSearchContent
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
            className="bg-transparent"
          />
        </div>
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
    <WorkspaceOverlayFrame ariaLabel={ariaLabel} onClose={onClose}>
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <FolderOpen className="size-5 text-white/20 shrink-0" />
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-sm font-medium text-white/80">
              {projectName}
            </span>
            {activeWorktree && (
              <>
                <GitBranch className="size-3 text-white/40 shrink-0" />
                <span className="text-xs text-white/40 truncate">
                  {activeWorktree.label}
                </span>
              </>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[50vh]">
          {activeWorktree ? (
            <div className="px-2 py-2">
              <FileTree
                rootPath={activeWorktree.path}
                onFileClick={handleFileClick}
                className="py-1"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <FolderOpen className="size-8 text-white/20" />
              <p className="text-sm text-white/40">
                Select a worktree to browse files
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </WorkspaceOverlayFrame>
  );
}
