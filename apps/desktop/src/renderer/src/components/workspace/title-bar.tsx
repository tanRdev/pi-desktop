import type { RepositorySnapshot } from "@pidesk/shared";
import {
  FolderTree,
  GitBranch,
  PanelLeft,
  PanelLeftClose,
  StickyNote,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTitleBarLeftPadding } from "../../lib/title-bar-layout";

export interface TitleBarProps {
  activeRepository: RepositorySnapshot | null;
  activeWorktreeLabel: string | null;
  sidebarView: "files" | "git" | "notes" | null;
  setSidebarView: (view: "files" | "git" | "notes" | null) => void;
  hasOpenNotes: boolean;
  isMainWindowFullscreen: boolean;
  isLeftSidebarCollapsed: boolean;
  onToggleLeftSidebar: () => void;
  onOpenLauncher: () => void;
  onOpenNote: () => void;
  onOpenGit: () => void;
  onOpenTerminal: () => void;
}

export function TitleBar({
  activeRepository,
  activeWorktreeLabel,
  sidebarView,
  setSidebarView,
  hasOpenNotes,
  isMainWindowFullscreen,
  isLeftSidebarCollapsed,
  onToggleLeftSidebar,
  onOpenLauncher,
  onOpenNote,
  onOpenGit,
  onOpenTerminal,
}: TitleBarProps) {
  const leftPadding = getTitleBarLeftPadding(isMainWindowFullscreen);

  return (
    <div
      data-drag-region="true"
      className="titlebar relative flex h-10 shrink-0 items-center justify-between px-3 bg-[#0e0e0e] border-b border-[#474747]/30 z-50"
    >
      <div className="flex items-center gap-6">
        <div className="flex gap-4" data-no-drag="true">
          <button
            type="button"
            onClick={onOpenTerminal}
            className="font-mono text-[11px] tracking-tight uppercase text-[#474747] hover:text-white transition-colors"
          >
            TERMINAL
          </button>
          <button
            type="button"
            className="font-mono text-[11px] tracking-tight uppercase text-[#474747] hover:text-white transition-colors"
          >
            LOGS
          </button>
          <button
            type="button"
            onClick={() =>
              setSidebarView(sidebarView === "files" ? null : "files")
            }
            className={cn(
              "font-mono text-[11px] tracking-tight uppercase transition-colors",
              sidebarView === "files"
                ? "text-white"
                : "text-[#474747] hover:text-white",
            )}
          >
            FILES
          </button>
          <button
            type="button"
            className="font-mono text-[11px] tracking-tight uppercase text-[#474747] hover:text-white transition-colors"
          >
            NETWORK
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3" data-no-drag="true">
        <div className="bg-[#1f1f1f] h-6 flex items-center px-2 border border-[#474747]/30">
          <span className="text-[#474747] mr-2">
            <PanelLeft className="size-3" />
          </span>
          <input
            className="bg-transparent border-none text-[10px] focus:ring-0 w-32 uppercase placeholder:text-[#474747]/50 font-mono"
            placeholder="CMD + K"
            type="text"
          />
        </div>
        <button
          type="button"
          onClick={onToggleLeftSidebar}
          className="text-[#474747] hover:text-white transition-colors"
        >
          <PanelLeft className="size-4" />
        </button>
        <button
          type="button"
          className="text-[#474747] hover:text-white transition-colors"
        >
          <StickyNote className="size-4" />
        </button>
      </div>
    </div>
  );
}
