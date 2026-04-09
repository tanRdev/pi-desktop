// Cursor Glass Layout - Complete app shell matching Cursor exactly
import * as React from "react";
import { CornersOut, MagnifyingGlass, Minus, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { CursorChat } from "./cursor-chat";
import { CursorSidebar, SIDEBAR_WIDTH } from "./cursor-sidebar";
import { CursorTerminal } from "./cursor-terminal";

interface CursorLayoutProps {
  className?: string;
}

export function CursorLayout({ className }: CursorLayoutProps) {
  const [showTerminal, setShowTerminal] = React.useState(true);

  return (
    <div
      className={cn(
        "flex h-screen w-full overflow-hidden bg-[#0a0a0a]",
        className,
      )}
    >
      {/* Left Sidebar */}
      <CursorSidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 min-w-0">
        {/* Chat Area */}
        <div className="flex flex-1 min-w-0 flex-col">
          {/* Top Bar - Cursor style */}
          <div className="flex h-9 items-center justify-between border-b border-white/[0.03] px-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/30 font-mono">zsh</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/50 hover:bg-white/[0.05] transition-colors"
              >
                <MagnifyingGlass className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowTerminal(!showTerminal)}
                className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/50 hover:bg-white/[0.05] transition-colors"
              >
                {showTerminal ? (
                  <Minus className="size-3.5" />
                ) : (
                  <CornersOut className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/50 hover:bg-white/[0.05] transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Chat Content */}
          <CursorChat className="flex-1" />
        </div>

        {/* Right Terminal Panel */}
        {showTerminal && (
          <div className="w-[400px] min-w-[400px] border-l border-white/[0.03]">
            <CursorTerminal className="h-full" />
          </div>
        )}
      </div>
    </div>
  );
}
