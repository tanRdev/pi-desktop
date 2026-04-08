// Cursor Glass Terminal Panel - Complete redesign to match Cursor exactly
import * as React from "react";
import { cn } from "@/lib/utils";
import { X, Plus, TerminalWindow } from "@/components/ui/icons";

interface CursorTerminalProps {
  className?: string;
}

export function CursorTerminal({ className }: CursorTerminalProps) {
  return (
    <div className={cn("flex h-full flex-col bg-[#0c0c0c]", className)}>
      {/* Terminal Header - Cursor style */}
      <div className="flex h-9 items-center justify-between border-b border-white/[0.03] px-3">
        <div className="flex items-center gap-2">
          <TerminalWindow className="size-4 text-white/40" />
          <span className="text-[12px] font-medium text-white/60">zsh</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/50 hover:bg-white/[0.05] transition-colors"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/50 hover:bg-white/[0.05] transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Tabs - Cursor style */}
      <div className="flex border-b border-white/[0.03]">
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-[12px]",
            "text-white/60 border-b border-white/20 -mb-px",
            "bg-white/[0.02]"
          )}
        >
          <span className="text-white/40">⌄</span>
          <span>main</span>
        </button>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 overflow-hidden p-3 font-mono text-[13px]">
        <div className="text-white/50">~/Dev/PiDesk</div>
        <div className="flex items-center gap-2 text-white/70">
          <span className="text-white/40">❯</span>
          <span className="animate-pulse">|</span>
        </div>
      </div>
    </div>
  );
}
