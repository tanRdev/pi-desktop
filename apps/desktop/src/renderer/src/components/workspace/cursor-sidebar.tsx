// Cursor Glass Sidebar - Complete redesign to match Cursor exactly
import type * as React from "react";
import {
  Chat,
  Command,
  FolderOpen,
  Plus,
  Settings,
  SquaresFour,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export const SIDEBAR_WIDTH = 280;

interface CursorSidebarProps {
  className?: string;
}

export function CursorSidebar({ className }: CursorSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col select-none",
        "bg-[var(--color-bg-secondary)]",
        "border-r border-white/[0.03]",
        className,
      )}
      style={{ width: SIDEBAR_WIDTH }}
    >
      {/* New Agent Button - Cursor style */}
      <div className="p-3 select-none">
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2.5",
            "bg-white/[0.05] hover:bg-white/[0.08]",
            "border border-white/[0.06]",
            "transition-all duration-150",
          )}
        >
          <Plus className="size-5 text-white/70" />
          <span className="text-[10.5px] font-normal text-white/90">
            New Agent
          </span>
          <span className="ml-auto text-[10.5px] text-white/30 font-mono">
            ⌘N
          </span>
        </button>
      </div>

      {/* Navigation Section */}
      <div className="px-2 select-none">
        <nav className="space-y-0.5">
          <SidebarItem
            icon={<SquaresFour className="size-5" />}
            label="Marketplace"
          />
        </nav>
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 h-px bg-white/[0.04]" />

      {/* File Tree Section */}
      <div className="flex-1 overflow-y-auto px-2 select-none">
        <div className="space-y-0.5">
          <FileTreeItem
            icon={<FolderOpen className="size-5" />}
            label="tan/dev/pi-desktop"
            active
          />
          <FileTreeItem
            icon={<Chat className="size-5" />}
            label="No agents yet"
            indented
          />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="border-t border-white/[0.03] p-2 select-none">
        {/* Open Workspace Button - Cursor style */}
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2",
            "text-white/40 hover:text-white/70 hover:bg-white/[0.03]",
            "transition-all duration-150",
          )}
        >
          <Command className="size-5" />
          <span className="text-[10.5px]">Open Workspace</span>
        </button>

        {/* User Profile - Cursor style */}
        <div className="mt-2 flex items-center gap-3 px-3 py-2 hover:bg-white/[0.03] cursor-pointer transition-colors select-none">
          <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
            <span className="text-[10.5px] font-normal text-white">T</span>
          </div>
          <div className="flex-1 min-w-0 select-none">
            <div className="text-[10.5px] font-normal text-white/90 truncate">
              Tanvi
            </div>
            <div className="text-[10.5px] text-white/40">Free Plan</div>
          </div>
          <Settings className="size-5 text-white/30" />
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({
  icon,
  label,
  shortcut,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2",
        "text-white/50 hover:text-white/80 hover:bg-white/[0.03]",
        "transition-all duration-150",
      )}
    >
      <span className="text-white/40">{icon}</span>
      <span className="text-[10.5px]">{label}</span>
      {shortcut && (
        <span className="ml-auto text-[10.5px] text-white/30 font-mono">
          {shortcut}
        </span>
      )}
    </button>
  );
}

function FileTreeItem({
  icon,
  label,
  active,
  indented,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  indented?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5",
        "transition-all duration-150",
        indented && "pl-8",
        active
          ? "bg-white/[0.06] text-white/90"
          : "text-white/40 hover:text-white/60 hover:bg-white/[0.02]",
      )}
    >
      <span className={cn("text-white/50", active && "text-white/70")}>
        {icon}
      </span>
      <span className="text-[10.5px] truncate">{label}</span>
    </button>
  );
}
